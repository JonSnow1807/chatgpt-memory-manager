from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import chromadb
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB
try:
    if os.getenv("RAILWAY_ENVIRONMENT"):
        logger.info("Running on Railway - using ephemeral ChromaDB")
        chroma_client = chromadb.EphemeralClient()
    else:
        logger.info("Running locally - using persistent ChromaDB")
        chroma_client = chromadb.PersistentClient(path="./memory_db")
    
    # Create collection without embedding function for now
    collection = chroma_client.get_or_create_collection(name="chatgpt_memories")
    logger.info("ChromaDB collection created successfully")
except Exception as e:
    logger.error(f"ChromaDB initialization error: {e}")
    raise

# Initialize OpenAI
try:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OpenAI API key not found - AI features will be limited")
        client = None
    else:
        client = openai.OpenAI(api_key=api_key)
        logger.info("OpenAI client initialized successfully")
except Exception as e:
    logger.error(f"OpenAI initialization error: {e}")
    client = None

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

# Routes
@app.get("/")
async def root():
    return {
        "status": "ChatGPT Memory Manager API Running",
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "local"),
        "openai_configured": client is not None,
        "chromadb_configured": True
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
        
        # Generate summary
        summary = ""
        if client:
            try:
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "Extract key facts and important information from this conversation. Be concise."},
                        {"role": "user", "content": conversation_text}
                    ],
                    max_tokens=200
                )
                summary = response.choices[0].message.content
            except Exception as e:
                logger.error(f"OpenAI API error: {e}")
                summary = f"Error generating summary: {str(e)}"
        
        # Fallback summary if OpenAI fails or is not configured
        if not summary:
            first_msg = conversation.messages[0].content[:100] if conversation.messages else "Empty conversation"
            summary = f"Conversation starting with: {first_msg}..."
        
        # Store in ChromaDB
        doc_id = str(uuid.uuid4())
        
        metadata = {
            "summary": summary,
            "timestamp": datetime.now().isoformat(),
            "message_count": len(conversation.messages),
            "url": conversation.url,
            "title": conversation.title or "Untitled Conversation"
        }
        
        collection.add(
            documents=[conversation_text],
            metadatas=[metadata],
            ids=[doc_id]
        )
        
        logger.info(f"Saved conversation {doc_id}")
        
        return {
            "status": "success",
            "id": doc_id,
            "summary": summary,
            "message_count": len(conversation.messages)
        }
        
    except Exception as e:
        logger.error(f"Error in save_conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search_memory")
async def search_memory(query: SearchQuery):
    try:
        # Search in ChromaDB
        results = collection.query(
            query_texts=[query.query],
            n_results=query.limit
        )
        
        # Format results
        memories = []
        if results and results.get('documents'):
            docs = results['documents'][0] if results['documents'] else []
            metas = results['metadatas'][0] if results['metadatas'] else []
            
            for i in range(len(docs)):
                memories.append({
                    "content": docs[i][:200] + "..." if len(docs[i]) > 200 else docs[i],
                    "metadata": metas[i] if i < len(metas) else {},
                    "relevance": 0.9
                })
        
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
                    "title": "Untitled"
                }
                
                # Safely extract metadata
                if all_data.get('metadatas') and i < len(all_data['metadatas']):
                    metadata = all_data['metadatas'][i]
                    memory_data.update({
                        "summary": metadata.get('summary', ''),
                        "timestamp": metadata.get('timestamp', ''),
                        "title": metadata.get('title', 'Untitled')
                    })
                
                memories.append(memory_data)
        
        # Sort by timestamp (newest first)
        memories.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return {"memories": memories, "total": len(memories)}
        
    except Exception as e:
        logger.error(f"Error in get_all_memories: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
