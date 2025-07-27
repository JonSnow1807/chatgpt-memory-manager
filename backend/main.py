from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import chromadb
from chromadb.utils import embedding_functions
import openai
from dotenv import load_dotenv
import os
import json
from datetime import datetime
import uuid
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI()

# CORS middleware
@app.middleware("http")
async def cors_handler(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.options("/{path:path}")
async def options_handler(path: str):
    return JSONResponse(
        content={},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI
try:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API key not found")
    
    client = openai.OpenAI(api_key=api_key)
    
    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=api_key,
        model_name="text-embedding-3-small"
    )
    logger.info("OpenAI client and embeddings initialized successfully")
except Exception as e:
    logger.error(f"OpenAI initialization error: {e}")
    openai_ef = embedding_functions.DefaultEmbeddingFunction()
    client = None

# Initialize ChromaDB
try:
    if os.getenv("RAILWAY_ENVIRONMENT"):
        logger.info("Running on Railway - using ephemeral ChromaDB")
        chroma_client = chromadb.EphemeralClient()
    else:
        logger.info("Running locally - using persistent ChromaDB")
        chroma_client = chromadb.PersistentClient(path="./memory_db")
    
    collection = chroma_client.get_or_create_collection(
        name="chatgpt_memories",
        embedding_function=openai_ef
    )
    logger.info("ChromaDB collection created with OpenAI embeddings")
except Exception as e:
    logger.error(f"ChromaDB initialization error: {e}")
    raise

# Data models
class Message(BaseModel):
    role: str
    content: str
    timestamp: str

class Conversation(BaseModel):
    messages: List[Message]
    url: str = ""
    title: str = ""

class SearchQuery(BaseModel):
    query: str
    limit: int = 5

class MemoryUpdate(BaseModel):
    summary: str
    title: str

# NEW: Prompt Analysis Model
class PromptAnalysisRequest(BaseModel):
    prompt: str

# Routes
@app.get("/")
async def root():
    return {
        "status": "ChatGPT Memory Manager API Running",
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "local"),
        "openai_configured": client is not None,
        "chromadb_configured": True,
        "embedding_model": "text-embedding-3-small" if client else "default"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# NEW: Real OpenAI Prompt Analysis Endpoint
@app.post("/analyze_prompt")
async def analyze_prompt(request: PromptAnalysisRequest):
    if not client:
        raise HTTPException(status_code=503, detail="OpenAI not configured")
    
    try:
        prompt_text = request.prompt.strip()
        
        if len(prompt_text) < 3:
            return {
                "score": 0,
                "analysis": "Start typing to get AI-powered analysis...",
                "suggestions": [],
                "strengths": [],
                "context": "general"
            }
        
        # Use GPT-4o-mini for fast, cost-effective analysis
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": """You are an expert prompt engineering coach. Analyze the given prompt and provide:

1. A score from 0-10 (10 being excellent)
2. Context/domain detection (programming, writing, business, health, legal, finance, travel, cooking, sports, science, technology, gaming, home, relationships, creative, learning, or general)
3. Specific strengths of the prompt
4. Actionable suggestions for improvement
5. Brief analysis explanation

Respond in JSON format:
{
  "score": 7.5,
  "context": "programming", 
  "strengths": ["Clear question format", "Provides context"],
  "suggestions": ["Specify programming language", "Include error details"],
  "analysis": "This prompt shows good structure but could be more specific..."
}

Focus on prompt engineering best practices:
- Specificity and clarity
- Context provision
- Clear instructions
- Example requests
- Appropriate length
- Question format
- Politeness
- Domain-specific needs"""
                },
                {
                    "role": "user",
                    "content": f"Analyze this prompt: '{prompt_text}'"
                }
            ],
            max_tokens=300,
            temperature=0.3
        )
        
        # Parse OpenAI response
        ai_response = response.choices[0].message.content
        
        try:
            # Try to parse JSON response
            result = json.loads(ai_response)
            
            # Validate and clean the response
            analysis_result = {
                "score": min(10, max(0, float(result.get("score", 0)))),
                "context": result.get("context", "general"),
                "strengths": result.get("strengths", [])[:4],  # Limit to 4
                "suggestions": result.get("suggestions", [])[:3],  # Limit to 3
                "analysis": result.get("analysis", "AI analysis completed")[:200]  # Limit length
            }
            
            logger.info(f"Analyzed prompt: score={analysis_result['score']}, context={analysis_result['context']}")
            return analysis_result
            
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            logger.warning("Failed to parse OpenAI JSON response")
            return {
                "score": 5.0,
                "context": "general",
                "strengths": ["Processed by AI"],
                "suggestions": ["AI analysis completed"],
                "analysis": ai_response[:200]
            }
            
    except Exception as e:
        logger.error(f"Error in prompt analysis: {str(e)}")
        # Return fallback analysis
        return {
            "score": 3.0,
            "context": "general", 
            "strengths": [],
            "suggestions": ["OpenAI analysis temporarily unavailable"],
            "analysis": "Using fallback analysis due to API issues"
        }

@app.post("/save_conversation")
async def save_conversation(conversation: Conversation):
    try:
        conversation_text = "\n".join([
            f"{msg.role}: {msg.content}" 
            for msg in conversation.messages
        ])
        
        summary = ""
        key_topics = []
        
        if client:
            try:
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": """Extract:
                        1. A concise summary of the key information
                        2. Main topics discussed (comma-separated)
                        Format: 
                        Summary: [your summary]
                        Topics: [topic1, topic2, topic3]"""},
                        {"role": "user", "content": conversation_text}
                    ],
                    max_tokens=300
                )
                
                full_response = response.choices[0].message.content
                
                if "Summary:" in full_response and "Topics:" in full_response:
                    parts = full_response.split("Topics:")
                    summary = parts[0].replace("Summary:", "").strip()
                    topics_str = parts[1].strip()
                    key_topics = [t.strip() for t in topics_str.split(",")]
                else:
                    summary = full_response
                    
            except Exception as e:
                logger.error(f"OpenAI API error: {e}")
                summary = f"Error generating summary: {str(e)}"
        
        if not summary:
            first_msg = conversation.messages[0].content[:100] if conversation.messages else "Empty conversation"
            summary = f"Conversation starting with: {first_msg}..."
        
        enhanced_document = f"{summary}\n\nTopics: {', '.join(key_topics)}\n\nFull conversation:\n{conversation_text}"
        
        doc_id = str(uuid.uuid4())
        
        metadata = {
            "summary": summary,
            "timestamp": datetime.now().isoformat(),
            "message_count": len(conversation.messages),
            "url": conversation.url,
            "title": conversation.title or "Untitled Conversation",
            "topics": json.dumps(key_topics),
            "first_message": conversation.messages[0].content[:200] if conversation.messages else ""
        }
        
        collection.add(
            documents=[enhanced_document],
            metadatas=[metadata],
            ids=[doc_id]
        )
        
        logger.info(f"Saved conversation {doc_id} with topics: {key_topics}")
        
        return {
            "status": "success",
            "id": doc_id,
            "summary": summary,
            "message_count": len(conversation.messages),
            "topics": key_topics
        }
        
    except Exception as e:
        logger.error(f"Error in save_conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search_memory")
async def search_memory(query: SearchQuery):
    try:
        logger.info(f"Searching for: {query.query}")
        
        results = collection.query(
            query_texts=[query.query],
            n_results=min(query.limit, 20),
            include=["documents", "metadatas", "distances"]
        )
        
        memories = []
        if results and results.get('documents') and results['documents'][0]:
            docs = results['documents'][0]
            metas = results['metadatas'][0] if results.get('metadatas') else []
            distances = results['distances'][0] if results.get('distances') else []
            
            for i in range(len(docs)):
                distance = distances[i] if i < len(distances) else 1.0
                relevance = max(0, min(1, 1 - (distance / 2)))
                
                if relevance > 0.3:
                    memories.append({
                        "content": docs[i][:300] + "..." if len(docs[i]) > 300 else docs[i],
                        "metadata": metas[i] if i < len(metas) else {},
                        "relevance": round(relevance, 2),
                        "distance": distance
                    })
            
            memories.sort(key=lambda x: x['relevance'], reverse=True)
            memories = memories[:query.limit]
        
        logger.info(f"Found {len(memories)} relevant results")
        return {"memories": memories}
        
    except Exception as e:
        logger.error(f"Error in search_memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_all_memories")
async def get_all_memories():
    try:
        all_data = collection.get()
        
        memories = []
        if all_data and all_data.get('ids'):
            for i in range(len(all_data['ids'])):
                memory_data = {
                    "id": all_data['ids'][i],
                    "summary": "",
                    "timestamp": "",
                    "title": "Untitled",
                    "topics": []
                }
                
                if all_data.get('metadatas') and i < len(all_data['metadatas']):
                    metadata = all_data['metadatas'][i]
                    memory_data.update({
                        "summary": metadata.get('summary', ''),
                        "timestamp": metadata.get('timestamp', ''),
                        "title": metadata.get('title', 'Untitled'),
                        "topics": json.loads(metadata.get('topics', '[]'))
                    })
                
                memories.append(memory_data)
        
        memories.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return {"memories": memories, "total": len(memories)}
        
    except Exception as e:
        logger.error(f"Error in get_all_memories: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete_memory/{memory_id}")
async def delete_memory(memory_id: str):
    try:
        collection.delete(ids=[memory_id])
        logger.info(f"Deleted memory {memory_id}")
        return {"status": "success", "deleted_id": memory_id}
    except Exception as e:
        logger.error(f"Error deleting memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/update_memory/{memory_id}")
async def update_memory(memory_id: str, update: MemoryUpdate):
    try:
        existing = collection.get(ids=[memory_id])
        
        if not existing or not existing.get('ids'):
            raise HTTPException(status_code=404, detail="Memory not found")
        
        metadata = existing['metadatas'][0]
        metadata['summary'] = update.summary
        metadata['title'] = update.title
        
        collection.update(
            ids=[memory_id],
            metadatas=[metadata]
        )
        
        logger.info(f"Updated memory {memory_id}")
        return {"status": "success", "updated_id": memory_id}
        
    except Exception as e:
        logger.error(f"Error updating memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
