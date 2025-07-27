from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://frontend-eta-murex-79.vercel.app",
        "https://chatgpt.com", 
        "https://chat.openai.com",
        "http://localhost:3000",
        "http://localhost:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize OpenAI
try:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OpenAI API key not found")
    
    client = openai.OpenAI(api_key=api_key)
    
    # Create OpenAI embedding function for ChromaDB
    openai_ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=api_key,
        model_name="text-embedding-3-small"
    )
    logger.info("OpenAI client and embeddings initialized successfully")
except Exception as e:
    logger.error(f"OpenAI initialization error: {e}")
    # Fallback to default embeddings
    openai_ef = embedding_functions.DefaultEmbeddingFunction()
    client = None

# Initialize ChromaDB
try:
    if os.getenv("RAILWAY_ENVIRONMENT"):
        logger.info("Running on Railway - using ephemeral ChromaDB")
        # For Railway, we need a persistent solution
        # Using ephemeral means data is lost on restart
        chroma_client = chromadb.EphemeralClient()
    else:
        logger.info("Running locally - using persistent ChromaDB")
        chroma_client = chromadb.PersistentClient(path="./memory_db")
    
    # Create collection with OpenAI embeddings for semantic search
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

@app.post("/save_conversation")
async def save_conversation(conversation: Conversation):
    try:
        # Extract conversation text
        conversation_text = "\n".join([
            f"{msg.role}: {msg.content}" 
            for msg in conversation.messages
        ])
        
        # Generate intelligent summary using GPT-4 for better quality
        summary = ""
        key_topics = []
        
        if client:
            try:
                # Extract summary and key topics
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
                
                # Parse response
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
        
        # Fallback summary
        if not summary:
            first_msg = conversation.messages[0].content[:100] if conversation.messages else "Empty conversation"
            summary = f"Conversation starting with: {first_msg}..."
        
        # Create document with enhanced content for better search
        # Include summary and topics in the document for semantic search
        enhanced_document = f"{summary}\n\nTopics: {', '.join(key_topics)}\n\nFull conversation:\n{conversation_text}"
        
        # Store in ChromaDB
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
        
        # Search in ChromaDB with semantic search
        results = collection.query(
            query_texts=[query.query],
            n_results=min(query.limit, 20),  # Get more results for better ranking
            include=["documents", "metadatas", "distances"]
        )
        
        # Format results with relevance scores
        memories = []
        if results and results.get('documents') and results['documents'][0]:
            docs = results['documents'][0]
            metas = results['metadatas'][0] if results.get('metadatas') else []
            distances = results['distances'][0] if results.get('distances') else []
            
            for i in range(len(docs)):
                # Calculate relevance score (0-1, where 1 is most relevant)
                # ChromaDB distance is 0-2, where 0 is most similar
                distance = distances[i] if i < len(distances) else 1.0
                relevance = max(0, min(1, 1 - (distance / 2)))
                
                # Only include results with reasonable relevance
                if relevance > 0.3:
                    memories.append({
                        "content": docs[i][:300] + "..." if len(docs[i]) > 300 else docs[i],
                        "metadata": metas[i] if i < len(metas) else {},
                        "relevance": round(relevance, 2),
                        "distance": distance
                    })
            
            # Sort by relevance
            memories.sort(key=lambda x: x['relevance'], reverse=True)
            
            # Limit to requested number
            memories = memories[:query.limit]
        
        logger.info(f"Found {len(memories)} relevant results")
        return {"memories": memories}
        
    except Exception as e:
        logger.error(f"Error in search_memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_all_memories")
async def get_all_memories():
    try:
        # Get all documents
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
                
                # Safely extract metadata
                if all_data.get('metadatas') and i < len(all_data['metadatas']):
                    metadata = all_data['metadatas'][i]
                    memory_data.update({
                        "summary": metadata.get('summary', ''),
                        "timestamp": metadata.get('timestamp', ''),
                        "title": metadata.get('title', 'Untitled'),
                        "topics": json.loads(metadata.get('topics', '[]'))
                    })
                
                memories.append(memory_data)
        
        # Sort by timestamp (newest first)
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
        # Get existing memory
        existing = collection.get(ids=[memory_id])
        
        if not existing or not existing.get('ids'):
            raise HTTPException(status_code=404, detail="Memory not found")
        
        # Update metadata
        metadata = existing['metadatas'][0]
        metadata['summary'] = update.summary
        metadata['title'] = update.title
        
        # Update the document
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
