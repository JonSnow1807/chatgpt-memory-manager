from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import chromadb
from chromadb.utils import embedding_functions
import openai
from dotenv import load_dotenv
import os
import json
from datetime import datetime, timedelta
import uuid
import logging
import re
import statistics

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI
app = FastAPI()

# Rate limiting storage (in-memory for now)
user_rate_limits = {}

# CORS middleware
@app.middleware("http")
async def cors_handler(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for health checks
    if request.url.path in ["/", "/health"]:
        return await call_next(request)
    
    # Get user ID from header
    user_id = request.headers.get("X-User-ID", "anonymous")
    
    # Simple rate limiting: 200 requests per day per user
    today = datetime.now().date().isoformat()
    key = f"{user_id}:{today}"
    
    if key in user_rate_limits:
        if user_rate_limits[key] >= 200:
            return JSONResponse(
                status_code=429,
                content={"error": "Daily limit reached. Please try again tomorrow."}
            )
        user_rate_limits[key] += 1
    else:
        user_rate_limits[key] = 1
    
    # Clean old entries (simple cleanup)
    if len(user_rate_limits) > 1000:
        user_rate_limits.clear()
    
    response = await call_next(request)
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

# Utility function for smart text truncation
def smart_truncate(text, max_length=350):
    """Truncate text at sentence boundary, not mid-sentence"""
    if len(text) <= max_length:
        return text
    
    # First, try to find a good sentence boundary within a reasonable range
    truncated = text[:max_length]
    
    # Look for sentence endings (including those followed by quotes)
    sentence_patterns = [
        r'\.[\"\']?\s',  # Period followed by optional quote and space
        r'![\"\']?\s',   # Exclamation followed by optional quote and space
        r'\?[\"\']?\s',  # Question mark followed by optional quote and space
        r'\.\s',         # Period followed by space
        r'!\s',          # Exclamation followed by space
        r'\?\s'          # Question mark followed by space
    ]
    
    best_end = -1
    for pattern in sentence_patterns:
        matches = list(re.finditer(pattern, truncated))
        if matches:
            last_match = matches[-1]
            end_pos = last_match.end() - 1  # Don't include the trailing space
            if end_pos > max_length * 0.5:  # Must be at least halfway through
                best_end = max(best_end, end_pos)
    
    if best_end > 0:
        return text[:best_end + 1].rstrip()
    
    # Fallback: find last complete word
    last_space = truncated.rfind(' ')
    if last_space > max_length * 0.7:
        return text[:last_space] + "..."
    
    # Last resort: just cut at max length with ellipsis
    return text[:max_length].rstrip() + "..."

# Phase 2: Conversation analysis functions
def extract_topics_from_text(text: str) -> List[str]:
    """Extract main topics from a text using keyword analysis"""
    programming_keywords = ["code", "function", "variable", "class", "method", "python", "javascript", "bug", "error", "api", "database", "algorithm"]
    writing_keywords = ["write", "essay", "article", "content", "blog", "story", "draft", "edit", "grammar", "style"]
    business_keywords = ["strategy", "market", "analysis", "revenue", "customer", "business", "plan", "growth", "competition"]
    learning_keywords = ["explain", "understand", "learn", "concept", "theory", "definition", "example", "teach"]
    creative_keywords = ["design", "creative", "art", "brainstorm", "idea", "innovation", "inspiration"]
    health_keywords = ["health", "medical", "fitness", "wellness", "nutrition", "exercise", "symptoms"]
    finance_keywords = ["investment", "money", "budget", "financial", "trading", "economics", "profit"]
    travel_keywords = ["travel", "trip", "vacation", "hotel", "flight", "tourism", "destination"]
    
    text_lower = text.lower()
    topics = []
    
    keyword_groups = {
        "programming": programming_keywords,
        "writing": writing_keywords,
        "business": business_keywords,
        "learning": learning_keywords,
        "creative": creative_keywords,
        "health": health_keywords,
        "finance": finance_keywords,
        "travel": travel_keywords
    }
    
    for topic, keywords in keyword_groups.items():
        if any(keyword in text_lower for keyword in keywords):
            topics.append(topic)
    
    # Default topic if none detected
    if not topics:
        topics.append("general")
    
    return topics

def calculate_topic_coherence(topics_per_turn: List[List[str]]) -> float:
    """Calculate how coherent the conversation topics are"""
    if len(topics_per_turn) < 2:
        return 8.0
    
    # Count topic overlaps between consecutive turns
    overlap_scores = []
    for i in range(1, len(topics_per_turn)):
        current_topics = set(topics_per_turn[i])
        previous_topics = set(topics_per_turn[i-1])
        
        if not current_topics or not previous_topics:
            overlap_scores.append(0.5)
            continue
        
        intersection = len(current_topics.intersection(previous_topics))
        union = len(current_topics.union(previous_topics))
        
        overlap_score = intersection / union if union > 0 else 0
        overlap_scores.append(overlap_score)
    
    # Convert to 0-10 scale
    avg_overlap = statistics.mean(overlap_scores) if overlap_scores else 0.5
    coherence_score = 10 * avg_overlap + 3  # Bias towards higher scores
    
    return min(10.0, max(0.0, coherence_score))

def identify_conversation_issues(history: List[Dict]) -> List[str]:
    """Identify specific issues in conversation flow"""
    issues = []
    
    if len(history) < 2:
        return issues
    
    user_messages = [msg['content'] for msg in history if msg.get('role') == 'user']
    assistant_messages = [msg['content'] for msg in history if msg.get('role') == 'assistant']
    
    # Check for repetitive user questions
    if len(user_messages) >= 3:
        recent_messages = user_messages[-3:]
        if any(is_similar_question(recent_messages[0], msg) for msg in recent_messages[1:]):
            issues.append("repetitive_questions")
    
    # Check for vague responses
    if assistant_messages:
        last_response = assistant_messages[-1]
        if is_vague_response(last_response):
            issues.append("vague_response")
    
    # Check for conversation length without progression
    if len(history) > 10:
        issues.append("potentially_stuck")
    
    # Check for topic jumping
    topics_sequence = []
    for msg in user_messages:
        topics_sequence.extend(extract_topics_from_text(msg))
    
    if len(set(topics_sequence)) > len(topics_sequence) * 0.8:  # Too many different topics
        issues.append("topic_jumping")
    
    return issues

def is_similar_question(q1: str, q2: str) -> bool:
    """Check if two questions are similar"""
    q1_words = set(q1.lower().split())
    q2_words = set(q2.lower().split())
    
    if len(q1_words) == 0 or len(q2_words) == 0:
        return False
    
    intersection = len(q1_words.intersection(q2_words))
    union = len(q1_words.union(q2_words))
    
    similarity = intersection / union if union > 0 else 0
    return similarity > 0.6

def is_vague_response(response: str) -> bool:
    """Detect if an AI response is vague or unhelpful"""
    vague_indicators = [
        "it depends", "maybe", "possibly", "perhaps", "i'm not sure",
        "that's a good question", "there are many ways", "it varies"
    ]
    
    response_lower = response.lower()
    vague_count = sum(1 for indicator in vague_indicators if indicator in response_lower)
    
    # Also check for very short responses
    word_count = len(response.split())
    
    return vague_count >= 2 or word_count < 20

def analyze_conversation_coherence(history: List[Dict]) -> Dict:
    """Analyze if conversation maintains focus and coherence"""
    if len(history) < 4:  # Need at least 2 turns
        return {"coherence_score": 8.0, "issues": []}
    
    # Extract topics from each turn
    topics_per_turn = []
    for msg in history:
        if msg.get('role') == 'user':
            topics = extract_topics_from_text(msg.get('content', ''))
            topics_per_turn.append(topics)
    
    # Calculate topic drift
    if len(topics_per_turn) < 2:
        return {"coherence_score": 8.0, "issues": []}
    
    coherence_score = calculate_topic_coherence(topics_per_turn)
    issues = identify_conversation_issues(history)
    
    return {
        "coherence_score": coherence_score,
        "issues": issues,
        "topic_drift": len(set(sum(topics_per_turn, []))) / len(topics_per_turn) if topics_per_turn else 1.0,
        "conversation_depth": {"depth_score": 5.0, "progression": "stable"}
    }

def generate_conversation_suggestions(analysis: Dict, context: str) -> List[str]:
    """Generate specific suggestions based on conversation analysis"""
    suggestions = []
    issues = analysis.get("issues", [])
    coherence_score = analysis.get("coherence_score", 8.0)
    
    # Issue-specific suggestions
    if "repetitive_questions" in issues:
        suggestions.append("🔄 Try rephrasing your question or approaching from a different angle")
    
    if "vague_response" in issues:
        suggestions.append("🎯 Ask for specific examples or step-by-step explanations")
    
    if "topic_jumping" in issues:
        suggestions.append("📍 Focus on one topic at a time for better results")
    
    if "potentially_stuck" in issues:
        suggestions.append("💡 Consider summarizing what you've learned and asking a new question")
    
    # Coherence-based suggestions
    if coherence_score < 6.0:
        suggestions.append("🧭 Stay focused on your main goal to get better answers")
    
    # Context-specific suggestions
    context_suggestions = {
        "programming": [
            "💻 Include specific error messages or code snippets",
            "🔧 Describe what you've already tried"
        ],
        "writing": [
            "✍️ Specify your target audience and purpose",
            "📝 Ask for specific feedback on structure or style"
        ],
        "learning": [
            "🎓 Ask for real-world examples to understand better",
            "📚 Request step-by-step explanations"
        ]
    }
    
    if context in context_suggestions and len(suggestions) < 3:
        suggestions.extend(context_suggestions[context][:2])
    
    return suggestions[:3]  # Limit to 3 suggestions

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

class PromptAnalysisRequest(BaseModel):
    prompt: str

class PromptImprovementRequest(BaseModel):
    prompt: str
    analysis: Dict

# NEW Phase 2: Conversation analysis models
class ConversationAnalysisRequest(BaseModel):
    user_message: str
    assistant_message: str
    conversation_history: List[Dict] = []
    conversation_id: Optional[str] = None

class FollowUpRequest(BaseModel):
    conversation_history: List[Dict]
    user_goal: Optional[str] = None
    context: str = "general"

class ConversationQualityRequest(BaseModel):
    conversation_id: str
    full_conversation: List[Dict]

# Routes
@app.get("/")
async def root():
    return {
        "status": "ChatGPT Memory Manager API with User Isolation",
        "environment": os.getenv("RAILWAY_ENVIRONMENT", "local"),
        "openai_configured": client is not None,
        "chromadb_configured": True,
        "embedding_model": "text-embedding-3-small" if client else "default",
        "features": ["user_isolation", "rate_limiting", "conversation_analysis"],
        "version": "1.1.0"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# USER-ISOLATED ENDPOINTS

@app.post("/save_conversation")
async def save_conversation(conversation: Conversation, request: Request):
    # Get user ID from header
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")
    
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
            "user_id": user_id,  # USER ISOLATION
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
        
        logger.info(f"Saved conversation {doc_id} for user {user_id} with topics: {key_topics}")
        
        return {
            "status": "success",
            "id": doc_id,
            "user_id": user_id,
            "summary": summary,
            "message_count": len(conversation.messages),
            "topics": key_topics
        }
        
    except Exception as e:
        logger.error(f"Error in save_conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search_memory")
async def search_memory(query: SearchQuery, request: Request):
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")
    
    try:
        logger.info(f"User {user_id} searching for: {query.query}")
        
        # Search only within user's memories
        results = collection.query(
            query_texts=[query.query],
            n_results=min(query.limit, 20),
            where={"user_id": user_id},  # USER FILTER
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
        
        logger.info(f"Found {len(memories)} relevant results for user {user_id}")
        return {"memories": memories}
        
    except Exception as e:
        logger.error(f"Error in search_memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_all_memories")
async def get_all_memories(request: Request):
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")
    
    try:
        # Get only this user's memories
        all_data = collection.get(
            where={"user_id": user_id}  # USER FILTER
        )
        
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
        
        logger.info(f"Retrieved {len(memories)} memories for user {user_id}")
        return {"memories": memories, "total": len(memories), "user_id": user_id}
        
    except Exception as e:
        logger.error(f"Error in get_all_memories: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete_memory/{memory_id}")
async def delete_memory(memory_id: str, request: Request):
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")
    
    try:
        # Verify the memory belongs to this user
        existing = collection.get(ids=[memory_id])
        if not existing or not existing.get('ids'):
            raise HTTPException(status_code=404, detail="Memory not found")
        
        if existing['metadatas'][0].get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        collection.delete(ids=[memory_id])
        logger.info(f"Deleted memory {memory_id} for user {user_id}")
        return {"status": "success", "deleted_id": memory_id}
    except Exception as e:
        logger.error(f"Error deleting memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/update_memory/{memory_id}")
async def update_memory(memory_id: str, update: MemoryUpdate, request: Request):
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID required")
    
    try:
        existing = collection.get(ids=[memory_id])
        
        if not existing or not existing.get('ids'):
            raise HTTPException(status_code=404, detail="Memory not found")
        
        if existing['metadatas'][0].get('user_id') != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        metadata = existing['metadatas'][0]
        metadata['summary'] = update.summary
        metadata['title'] = update.title
        
        collection.update(
            ids=[memory_id],
            metadatas=[metadata]
        )
        
        logger.info(f"Updated memory {memory_id} for user {user_id}")
        return {"status": "success", "updated_id": memory_id}
        
    except Exception as e:
        logger.error(f"Error updating memory: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

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
                "analysis": smart_truncate(result.get("analysis", "AI analysis completed"))  # Smart truncation
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
                "analysis": smart_truncate(ai_response)  # Smart truncation for fallback too
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

@app.post("/improve_prompt")
async def improve_prompt(request: PromptImprovementRequest):
    if not client:
        raise HTTPException(status_code=503, detail="OpenAI not configured")
    
    try:
        original_prompt = request.prompt.strip()
        analysis = request.analysis
        
        # Create context-aware system prompt
        context = analysis.get('context', 'general')
        score = analysis.get('score', 0)
        suggestions = analysis.get('suggestions', [])
        
        system_prompt = f"""You are an expert prompt engineering coach. Your task is to rewrite the user's prompt to make it significantly more effective for ChatGPT.

Original prompt context: {context}
Current quality score: {score}/10
Key suggestions to address: {', '.join(suggestions)}

IMPROVEMENT GUIDELINES:
1. Keep the core intent but make it much more specific and clear
2. Add appropriate context and background information
3. Structure the request logically
4. Include relevant examples or specifications when helpful
5. Use polite, professional language
6. For {context} prompts, apply domain-specific best practices

IMPORTANT: 
- Don't completely change the user's intent
- Make the improved prompt practical and actionable
- Aim for 2-4x improvement in clarity and effectiveness
- Keep it concise but comprehensive

Return ONLY the improved prompt text, no explanations or meta-commentary."""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": f"Original prompt: '{original_prompt}'"
                }
            ],
            max_tokens=400,
            temperature=0.4
        )
        
        improved_prompt = response.choices[0].message.content.strip()
        
        # Remove quotes if the AI wrapped the response
        if improved_prompt.startswith('"') and improved_prompt.endswith('"'):
            improved_prompt = improved_prompt[1:-1]
        if improved_prompt.startswith("'") and improved_prompt.endswith("'"):
            improved_prompt = improved_prompt[1:-1]
        
        logger.info(f"Generated improved prompt (length: {len(improved_prompt)})")
        
        return {
            "improved_prompt": improved_prompt,
            "original_length": len(original_prompt),
            "improved_length": len(improved_prompt),
            "context": context
        }
        
    except Exception as e:
        logger.error(f"Error in prompt improvement: {str(e)}")
        return {
            "improved_prompt": f"Please help me with: {original_prompt}. Could you provide detailed explanations and examples?",
            "original_length": len(original_prompt),
            "improved_length": len(f"Please help me with: {original_prompt}. Could you provide detailed explanations and examples?"),
            "context": "fallback",
            "error": "AI improvement temporarily unavailable"
        }

# NEW Phase 2: Conversation Flow Analysis Endpoints

@app.post("/analyze_conversation_turn")
async def analyze_conversation_turn(request: ConversationAnalysisRequest):
    """Analyze a single conversation turn for quality and flow"""
    if not client:
        raise HTTPException(status_code=503, detail="OpenAI not configured")
    
    try:
        # Combine user message and assistant response for analysis
        conversation_text = f"User: {request.user_message}\nAssistant: {request.assistant_message}"
        
        # Add conversation history for context
        context_text = ""
        if request.conversation_history:
            recent_history = request.conversation_history[-6:]  # Last 3 turns
            context_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent_history])
        
        # Analyze conversation quality with OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert conversation flow analyst. Analyze this conversation turn and provide:

1. A flow quality score (0-10)
2. Issue identification (if any)
3. Specific improvement suggestions
4. Assessment of conversation direction

Focus on:
- Response relevance and helpfulness
- Question clarity and specificity  
- Conversation coherence and focus
- Depth of exploration
- Productive conversation patterns

Respond in JSON format:
{
  "flow_score": 7.5,
  "issue_type": "shallow_response" | "off_topic" | "repetitive" | "vague" | "good",
  "suggestions": ["Ask for specific examples", "Focus on one aspect"],
  "conversation_direction": "improving" | "declining" | "stable",
  "analysis": "Brief explanation of the assessment"
}"""
                },
                {
                    "role": "user", 
                    "content": f"Recent context:\n{context_text}\n\nCurrent turn:\n{conversation_text}"
                }
            ],
            max_tokens=250,
            temperature=0.3
        )
        
        ai_analysis = response.choices[0].message.content
        
        try:
            result = json.loads(ai_analysis)
            
            # Add local analysis
            local_analysis = analyze_conversation_coherence(request.conversation_history + [
                {"role": "user", "content": request.user_message},
                {"role": "assistant", "content": request.assistant_message}
            ])
            
            # Combine AI and local analysis
            final_result = {
                "flow_score": min(10, max(0, float(result.get("flow_score", 7)))),
                "issue_type": result.get("issue_type", "good"),
                "suggestions": result.get("suggestions", [])[:3],
                "conversation_direction": result.get("conversation_direction", "stable"),
                "analysis": smart_truncate(result.get("analysis", "Analysis complete")),
                "coherence_score": local_analysis["coherence_score"],
                "local_issues": local_analysis["issues"],
                "depth_info": local_analysis["conversation_depth"]
            }
            
            logger.info(f"Conversation turn analyzed: flow_score={final_result['flow_score']}")
            return final_result
            
        except json.JSONDecodeError:
            logger.warning("Failed to parse conversation analysis JSON")
            return {
                "flow_score": 6.0,
                "issue_type": "analysis_error",
                "suggestions": ["Continue the conversation naturally"],
                "conversation_direction": "stable",
                "analysis": "Analysis temporarily unavailable"
            }
            
    except Exception as e:
        logger.error(f"Error in conversation turn analysis: {str(e)}")
        return {
            "flow_score": 5.0,
            "issue_type": "error",
            "suggestions": ["Try rephrasing your question"],
            "conversation_direction": "stable",
            "analysis": "Analysis failed - continue conversation"
        }

@app.post("/suggest_followup")
async def suggest_followup(request: FollowUpRequest):
    """Generate intelligent follow-up questions based on conversation context"""
    if not client:
        raise HTTPException(status_code=503, detail="OpenAI not configured")
    
    try:
        # Prepare conversation context
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}" 
            for msg in request.conversation_history[-8:]  # Last 4 turns
        ])
        
        # Detect conversation context
        context = request.context
        if context == "general" and conversation_text:
            # Auto-detect context
            context_analysis = extract_topics_from_text(conversation_text)
            context = context_analysis[0] if context_analysis else "general"
        
        # Generate follow-up with OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are an expert at generating follow-up questions that deepen conversations and get better results from AI assistants.

Based on the conversation context, generate 1 excellent follow-up question that:
1. Builds naturally on the previous response
2. Seeks deeper, more specific information
3. Is appropriate for the {context} domain
4. Would likely lead to a more helpful AI response

Guidelines for {context} context:
- Programming: Ask for code examples, edge cases, best practices, or specific implementation details
- Writing: Request feedback on specific aspects, examples, or techniques
- Learning: Seek clarification, examples, or connections to prior knowledge
- Business: Ask for specific strategies, metrics, or real-world applications

Return only the follow-up question, no explanations."""
                },
                {
                    "role": "user",
                    "content": f"Conversation context:\n{conversation_text}\n\nUser goal: {request.user_goal or 'Not specified'}"
                }
            ],
            max_tokens=150,
            temperature=0.4
        )
        
        followup_question = response.choices[0].message.content.strip()
        
        # Clean up the response
        if followup_question.startswith('"') and followup_question.endswith('"'):
            followup_question = followup_question[1:-1]
        
        logger.info(f"Generated follow-up for {context} context")
        
        return {
            "followup_question": followup_question,
            "context": context,
            "confidence": 0.8
        }
        
    except Exception as e:
        logger.error(f"Error in follow-up suggestion: {str(e)}")
        
        # Fallback follow-ups based on context
        fallback_followups = {
            "programming": "Can you show me a specific code example of how this would work?",
            "writing": "What are some specific techniques I could use to improve this?",
            "learning": "Can you provide a real-world example to help me understand this better?",
            "business": "What specific metrics should I track to measure success with this approach?",
            "general": "Can you elaborate on the most important aspect of what you just explained?"
        }
        
        return {
            "followup_question": fallback_followups.get(context, fallback_followups["general"]),
            "context": context,
            "confidence": 0.5,
            "fallback": True
        }

@app.post("/analyze_conversation_quality")
async def analyze_conversation_quality(request: ConversationQualityRequest):
    """Analyze overall conversation quality and provide comprehensive feedback"""
    try:
        conversation = request.full_conversation
        
        if len(conversation) < 4:  # Need at least 2 turns
            return {
                "overall_score": 7.0,
                "analysis": "Conversation too short for comprehensive analysis",
                "suggestions": ["Continue the conversation to get better insights"]
            }
        
        # Comprehensive analysis
        coherence_analysis = analyze_conversation_coherence(conversation)
        
        # Calculate overall metrics
        user_messages = [msg for msg in conversation if msg.get('role') == 'user']
        assistant_messages = [msg for msg in conversation if msg.get('role') == 'assistant']
        
        # Quality metrics
        conversation_length = len(conversation)
        turn_count = len(user_messages)
        
        # Overall score calculation
        factors = {
            "coherence": coherence_analysis["coherence_score"] * 0.4,
            "length": min(10, conversation_length / 2) * 0.3,  # Optimal around 10 messages
            "engagement": min(10, turn_count * 2) * 0.3  # More turns = more engagement
        }
        
        overall_score = sum(factors.values())
        overall_score = min(10.0, max(0.0, overall_score))
        
        # Generate comprehensive suggestions
        suggestions = generate_conversation_suggestions(coherence_analysis, "general")
        
        return {
            "overall_score": round(overall_score, 1),
            "coherence_score": coherence_analysis["coherence_score"],
            "turn_count": turn_count,
            "issues": coherence_analysis["issues"],
            "suggestions": suggestions,
            "analysis": f"Analyzed {turn_count} conversation turns with {overall_score:.1f}/10 overall quality",
            "metrics": {
                "conversation_length": conversation_length,
                "topic_coherence": round(coherence_analysis["coherence_score"], 1),
                "depth_progression": coherence_analysis["conversation_depth"]["progression"]
            }
        }
        
    except Exception as e:
        logger.error(f"Error in conversation quality analysis: {str(e)}")
        return {
            "overall_score": 5.0,
            "analysis": "Analysis temporarily unavailable",
            "suggestions": ["Continue your conversation naturally"]
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)