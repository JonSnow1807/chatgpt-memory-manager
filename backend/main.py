from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import chromadb
from chromadb.utils import embedding_functions
import openai
from dotenv import load_dotenv
import os
import json
from datetime import datetime
import uuid

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

# Initialize ChromaDB for vector storage
chroma_client = chromadb.PersistentClient(path="./memory_db")
openai_ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name="text-embedding-3-small"
)

# Get or create collection
collection = chroma_client.get_or_create_collection(
    name="chatgpt_memories",
    embedding_function=openai_ef
)

# Initialize OpenAI
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
    return {"status": "ChatGPT Memory Manager API Running"}

@app.post("/save_conversation")
async def save_conversation(conversation: Conversation):
    try:
        # Extract key information from conversation
        conversation_text = "\n".join([
            f"{msg.role}: {msg.content}" 
            for msg in conversation.messages
        ])
        
        # Generate summary using GPT-3.5
        summary_response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "Extract key facts, preferences, and important information from this conversation. Be concise."},
                {"role": "user", "content": conversation_text}
            ],
            max_tokens=200
        )
        
        summary = summary_response.choices[0].message.content
        
        # Store in ChromaDB
        doc_id = str(uuid.uuid4())
        collection.add(
            documents=[conversation_text],
            metadatas=[{
                "summary": summary,
                "timestamp": datetime.now().isoformat(),
                "message_count": len(conversation.messages),
                "url": conversation.url,
                "title": conversation.title or "Untitled Conversation"
            }],
            ids=[doc_id]
        )
        
        return {
            "status": "success",
            "id": doc_id,
            "summary": summary,
            "message_count": len(conversation.messages)
        }
        
    except Exception as e:
        print(f"Error in save_conversation: {str(e)}")
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
        if results['documents'] and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                memories.append({
                    "content": results['documents'][0][i][:200] + "...",
                    "metadata": results['metadatas'][0][i],
                    "relevance": 1 - results['distances'][0][i]
                })
        
        return {"memories": memories}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_all_memories")
async def get_all_memories():
    try:
        # Get all documents
        all_data = collection.get()
        
        memories = []
        for i in range(len(all_data['ids'])):
            memories.append({
                "id": all_data['ids'][i],
                "summary": all_data['metadatas'][i].get('summary', ''),
                "timestamp": all_data['metadatas'][i].get('timestamp', ''),
                "title": all_data['metadatas'][i].get('title', 'Untitled')
            })
        
        return {"memories": memories, "total": len(memories)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
