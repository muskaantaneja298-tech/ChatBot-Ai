from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
import motor.motor_asyncio
import os
import traceback

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Defaulting to 2.5-flash as per your setup
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash") 

if not MONGO_URI:
    print("ERROR: MONGO_URI is missing in backend/.env")
if not GEMINI_API_KEY:
    print("ERROR: GEMINI_API_KEY is missing in backend/.env")

app = FastAPI(title="Pixie Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = client.chatbot_db
chat_collection = db.conversations

class ChatRequest(BaseModel):
    session_id: str
    message: str

genai_client = None
if GEMINI_API_KEY:
    try:
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
        print("Gemini client initialized.")
    except Exception as exc:
        print(f"ERROR initializing Gemini client: {exc}")


def serialize_document(doc: dict[str, Any]) -> dict[str, Any]:
    """Convert MongoDB document to JSON-safe dict (ObjectId -> str)."""
    if not doc:
        return doc
    serialized = dict(doc)
    if "_id" in serialized:
        serialized["_id"] = str(serialized["_id"])
    if "created_at" in serialized and isinstance(serialized["created_at"], datetime):
        serialized["created_at"] = serialized["created_at"].isoformat()
    return serialized


@app.on_event("startup")
async def verify_connections():
    try:
        await client.admin.command("ping")
        print("MongoDB connected successfully.")
    except Exception as exc:
        print(f"WARNING: MongoDB connection failed: {exc}")


@app.get("/health")
async def health_check():
    mongo_ok = False
    try:
        await client.admin.command("ping")
        mongo_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if mongo_ok and genai_client else "degraded",
        "mongodb": mongo_ok,
        "gemini": genai_client is not None,
        "model": GEMINI_MODEL,
    }

# -------------------------------------------------------------
# CHAT ENDPOINT (Now with AI Memory / Context)
# -------------------------------------------------------------
@app.post("/chat")
async def process_chat(request: ChatRequest):
    session_id = request.session_id.strip()
    message = request.message.strip()

    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if not genai_client:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")

    # 1. FETCH PAST HISTORY FOR AI MEMORY
    try:
        # Get the last 20 messages so the AI remembers the conversation
        cursor = chat_collection.find({"session_id": session_id}).sort("created_at", 1)
        past_chats = await cursor.to_list(length=20)
    except Exception:
        past_chats = []

    # 2. BUILD THE CONVERSATION ARRAY
    conversation_history = []
    for chat in past_chats:
        conversation_history.append({"role": "user", "parts": [{"text": chat["user_message"]}]})
        # Gemini expects 'model' instead of 'bot' or 'assistant'
        conversation_history.append({"role": "model", "parts": [{"text": chat["bot_response"]}]})

    # Add the brand new message to the end of the history
    conversation_history.append({"role": "user", "parts": [{"text": message}]})

    bot_reply = ""
    try:
        # Pass the ENTIRE history to Gemini, not just the single message
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=conversation_history, 
            config=types.GenerateContentConfig(
                system_instruction=(
                    "You are Pixie, a helpful, smart, and polite AI assistant. "
                    "Provide accurate, clear, and concise answers."
                )
            ),
        )
        bot_reply = response.text or "Sorry, I could not generate a response."
    except Exception as exc:
        print("\n========== GEMINI ERROR ==========")
        traceback.print_exc()
        print("==================================\n")
        raise HTTPException(status_code=502, detail=f"Gemini API error: {exc}")

    # 3. SAVE TO MONGODB
    now = datetime.now(timezone.utc)
    chat_document = {
        "session_id": session_id,
        "user_message": message,
        "bot_response": bot_reply,
        "created_at": now,
    }

    try:
        result = await chat_collection.insert_one(chat_document)
        saved = serialize_document({**chat_document, "_id": result.inserted_id})
        return {"reply": bot_reply, "chat": saved}
    except Exception as exc:
        print("\n========== DATABASE ERROR ==========")
        traceback.print_exc()
        print("====================================\n")
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

# -------------------------------------------------------------
# GET HISTORY ENDPOINT
# -------------------------------------------------------------
@app.get("/history/{session_id}")
async def get_chat_history(session_id: str):
    try:
        cursor = chat_collection.find({"session_id": session_id}).sort("created_at", 1)
        chats = await cursor.to_list(length=200)

        formatted_history = []
        for chat in chats:
            formatted_history.append({"text": chat["user_message"], "sender": "user"})
            formatted_history.append({"text": chat["bot_response"], "sender": "bot"})

        return {"history": formatted_history, "count": len(chats)}
    except Exception as exc:
        print(f"HISTORY FETCH ERROR: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch history")

# -------------------------------------------------------------
# NEW: CLEAR SESSION HISTORY ENDPOINT
# -------------------------------------------------------------
@app.delete("/history/clear/{session_id}")
async def clear_chat_history(session_id: str):
    try:
        result = await chat_collection.delete_many({"session_id": session_id})
        return {"cleared": True, "deleted_count": result.deleted_count}
    except Exception as exc:
        print(f"HISTORY CLEAR ERROR: {exc}")
        raise HTTPException(status_code=500, detail="Failed to clear history")

# -------------------------------------------------------------
# DB INSPECTION ENDPOINTS
# -------------------------------------------------------------
@app.get("/chats")
async def get_all_chats():
    """Return all raw chat documents from MongoDB for inspection."""
    try:
        cursor = chat_collection.find().sort("created_at", -1)
        chats = await cursor.to_list(length=500)
        serialized = [serialize_document(chat) for chat in chats]
        return {"total": len(serialized), "chats": serialized}
    except Exception as exc:
        print(f"CHATS FETCH ERROR: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch chats")


@app.get("/chats/{session_id}")
async def get_session_chats(session_id: str):
    """Return raw chat documents for one session."""
    try:
        cursor = chat_collection.find({"session_id": session_id}).sort("created_at", 1)
        chats = await cursor.to_list(length=200)
        serialized = [serialize_document(chat) for chat in chats]
        return {"session_id": session_id, "total": len(serialized), "chats": serialized}
    except Exception as exc:
        print(f"SESSION CHATS ERROR: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch session chats")


@app.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a single chat document by its MongoDB _id."""
    try:
        if not ObjectId.is_valid(chat_id):
            raise HTTPException(status_code=400, detail="Invalid chat id")
        result = await chat_collection.delete_one({"_id": ObjectId(chat_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Chat not found")
        return {"deleted": True, "id": chat_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    