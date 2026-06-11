import React, { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function ChatApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showInspect, setShowInspect] = useState(false);
  const [dbChats, setDbChats] = useState([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [lastSavedChat, setLastSavedChat] = useState(null);
  const messagesEndRef = useRef(null);

  const sessionId = "session-1";

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

  const fetchDbChats = useCallback(async () => {
    setInspectLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chats/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load chats");
      const data = await res.json();
      setDbChats(data.chats || []);
    } catch (error) {
      console.error("Inspect fetch error:", error);
      setDbChats([]);
    } finally {
      setInspectLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (showInspect) {
      fetchDbChats();
    }
  }, [showInspect, fetchDbChats]);

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
        if (data.chat) {
          setLastSavedChat(data.chat);
          if (showInspect) fetchDbChats();
        }
      } else {
        const errMsg = data.detail || "The AI API returned an error.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${errMsg}` },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network Error: Could not connect to backend. Is it running on port 8000?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#fce4ec", minHeight: "100vh", padding: "20px", fontFamily: "sans-serif" }}>
      <div
        style={{
          maxWidth: "700px",
          margin: "40px auto",
          backgroundColor: "white",
          borderRadius: "15px",
          padding: "20px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ textAlign: "center", color: "#d147a3", marginBottom: "8px" }}>
          Chat with Pixie
        </h1>
        <p style={{ textAlign: "center", color: "#888", fontSize: "0.85em", marginBottom: "16px" }}>
          Session: {sessionId} | API: {API_BASE}
        </p>

        <div
          style={{
            height: "400px",
            overflowY: "auto",
            borderBottom: "2px solid #ffe6f2",
            marginBottom: "20px",
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {messages.length === 0 && (
            <p style={{ textAlign: "center", color: "#aaa", marginTop: "auto", marginBottom: "auto" }}>
              Send a message to start chatting!
            </p>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "12px 18px",
                  borderRadius: "20px",
                  backgroundColor: msg.role === "user" ? "#d147a3" : "#f4f4f4",
                  color: msg.role === "user" ? "white" : "#333",
                  maxWidth: "80%",
                  lineHeight: "1.4",
                  wordWrap: "break-word",
                }}
              >
                {msg.content}
              </span>
            </div>
          ))}

          {isLoading && (
            <div style={{ textAlign: "left" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "12px 18px",
                  borderRadius: "20px",
                  backgroundColor: "#f4f4f4",
                  color: "#888",
                  fontStyle: "italic",
                  fontSize: "0.9em",
                }}
              >
                Pixie is typing...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #ffccf2",
              outline: "none",
            }}
            placeholder="Tell Pixie something..."
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading}
            style={{
              padding: "12px 24px",
              backgroundColor: isLoading ? "#ffb3e6" : "#d147a3",
              color: "white",
              border: "none",
              borderRadius: "10px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            Send
          </button>
        </div>

        <button
          onClick={() => setShowInspect((v) => !v)}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#fff0f6",
            border: "1px solid #ffccf2",
            borderRadius: "8px",
            color: "#d147a3",
            cursor: "pointer",
            fontWeight: "600",
            marginBottom: showInspect ? "12px" : "0",
          }}
        >
          {showInspect ? "Hide MongoDB Inspect" : "Inspect MongoDB Chats"}
        </button>

        {showInspect && (
          <div
            style={{
              backgroundColor: "#1e1e1e",
              color: "#d4d4d4",
              borderRadius: "8px",
              padding: "12px",
              maxHeight: "300px",
              overflowY: "auto",
              fontSize: "12px",
              fontFamily: "monospace",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "#9cdcfe" }}>
                {inspectLoading ? "Loading..." : `${dbChats.length} chat object(s) in DB`}
              </span>
              <button
                onClick={fetchDbChats}
                style={{
                  background: "#333",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
              >
                Refresh
              </button>
            </div>

            {lastSavedChat && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ color: "#4ec9b0", marginBottom: "4px" }}>Last saved object:</div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(lastSavedChat, null, 2)}
                </pre>
              </div>
            )}

            {dbChats.length === 0 && !inspectLoading && (
              <p style={{ color: "#888" }}>No chat objects found for this session yet.</p>
            )}

            {dbChats.map((chat, i) => (
              <div key={chat._id || i} style={{ marginBottom: "12px", borderTop: "1px solid #333", paddingTop: "8px" }}>
                <div style={{ color: "#ce9178", marginBottom: "4px" }}>
                  Object #{i + 1} — _id: {chat._id}
                </div>
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(chat, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
