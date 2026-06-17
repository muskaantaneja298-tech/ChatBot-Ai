# Pixie AI Chatbot

Pixie is a modern, full-stack conversational AI chatbot. It uses Google's Gemini API for intelligent responses, a FastAPI backend for high-performance request handling, MongoDB for persistent chat history, and a sleek React frontend.

##  Features

* **Conversational Memory:** The AI remembers the context of the current session for natural, flowing conversations.
* **Persistent Sessions:** Uses browser `localStorage` to keep your session alive even if you refresh the page.
* **Database Integration:** All chats are asynchronously saved to MongoDB.
* **Clear History:** A built-in feature to wipe the current chat session from both the screen and the database.
* **Responsive UI:** Clean, modern interface with auto-scrolling and loading states.

## Tech Stack

* **Frontend:** React.js
* **Backend:** Python, FastAPI, Uvicorn
* **Database:** MongoDB (via `motor` async driver)
* **AI Integration:** Google GenAI SDK (`gemini-2.5-flash`)

##  Getting Started

### Prerequisites
Make sure you have the following installed:
* Python 3.8+
* Node.js & npm
* MongoDB (Local server or MongoDB Atlas URI)
* Google Gemini API Key

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd backend
