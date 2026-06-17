"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Browser memory logic (AI will remember you)
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem("chat_session_id");
    if (saved) return saved;
    const newId = "session-" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem("chat_session_id", newId);
    return newId;
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/history/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.history) {
        const loadedMessages = data.history.map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage.content,
        }),
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Error: AI API issue." }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network Error: Backend down." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    if (!window.confirm("Are you sure you want to clear the chat history?")) return;
    
    try {
      await fetch(`${API_BASE}/history/clear/${sessionId}`, { method: "DELETE" });
      setMessages([]);
      const newId = "session-" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("chat_session_id", newId);
      setSessionId(newId);
    } catch (error) {
      console.error("Failed to clear chat", error);
    }
  };

  return (
    <div style={{ backgroundColor: "#fce4ec", minHeight: "100vh", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: "700px", margin: "40px auto", backgroundColor: "white", borderRadius: "15px", padding: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
        
        {/* Clean Header with Clear Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h1 style={{ color: "#d147a3", margin: 0 }}>Chat with Pixie</h1>
          <button 
            onClick={clearChat}
            style={{ padding: "8px 12px", backgroundColor: "#ff4d4d", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "0.9em" }}
          >
            Clear Chat
          </button>
        </div>

        {/* Chat Box */}
        <div style={{ height: "400px", overflowY: "auto", borderBottom: "2px solid #ffe6f2", marginBottom: "20px", padding: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {messages.length === 0 && (
            <p style={{ textAlign: "center", color: "#aaa", marginTop: "auto", marginBottom: "auto" }}>
              Send a message to start chatting!
            </p>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
              <span style={{ display: "inline-block", padding: "12px 18px", borderRadius: "20px", backgroundColor: msg.role === "user" ? "#d147a3" : "#f4f4f4", color: msg.role === "user" ? "white" : "#333", maxWidth: "80%", lineHeight: "1.4", wordWrap: "break-word" }}>
                {msg.content}
              </span>
            </div>
          ))}

          {isLoading && (
            <div style={{ textAlign: "left" }}>
              <span style={{ display: "inline-block", padding: "12px 18px", borderRadius: "20px", backgroundColor: "#f4f4f4", color: "#888", fontStyle: "italic", fontSize: "0.9em" }}>
                Pixie is typing...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ display: "flex", gap: "10px" }}>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #ffccf2", outline: "none" }}
            placeholder="Tell Pixie something..."
            disabled={isLoading}
          />
          <button 
            onClick={sendMessage} 
            disabled={isLoading}
            style={{ padding: "12px 24px", backgroundColor: isLoading ? "#ffb3e6" : "#d147a3", color: "white", border: "none", borderRadius: "10px", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "bold" }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}