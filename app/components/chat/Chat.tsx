import { useState } from "react";

interface ChatMessage {
  seat: number;
  text: string;
  playerName: string;
  timestamp: number;
}

interface ChatProps {
  messages: ChatMessage[];
  yourSeat: number;
  onSend: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

// Seat name colors — Tabledeck palette (gold, copper, silver, bone)
const SEAT_STYLES = [
  { color: "var(--gold)" },
  { color: "var(--copper)" },
  { color: "var(--silver)" },
  { color: "var(--bone)" },
];

// Simple chat SVG icon
function ChatIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

export function Chat({ messages, yourSeat, onSend, isOpen, onToggle }: ChatProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput("");
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onToggle}
        className="btn-ghost"
        style={{ padding: "5px 10px", display: "flex", alignItems: "center", gap: "6px" }}
      >
        <ChatIcon />
        Signal
        {messages.length > 0 && !isOpen && (
          <span style={{
            background: "var(--gold)",
            color: "var(--ink)",
            fontFamily: "var(--mono)",
            fontSize: "9px",
            fontWeight: 700,
            borderRadius: "999px",
            padding: "1px 5px",
            lineHeight: 1.4,
          }}>
            {messages.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: "280px",
          background: "linear-gradient(180deg, rgba(15,29,51,0.98) 0%, rgba(8,21,37,0.99) 100%)",
          border: "1px solid rgba(100,160,255,0.18)",
          borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(100,160,255,0.08)",
          zIndex: 10,
        }}>
          {/* Message list */}
          <div style={{ height: "140px", overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {messages.length === 0 ? (
              <p style={{
                fontFamily: "var(--serif)",
                fontStyle: "italic",
                fontSize: "11px",
                color: "rgba(246,239,224,0.25)",
                textAlign: "center",
                paddingTop: "16px",
              }}>
                No signals received...
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={{ fontFamily: "var(--sans)", fontSize: "11px" }}>
                  <span style={{ ...SEAT_STYLES[m.seat % SEAT_STYLES.length], fontWeight: 600 }}>
                    {m.playerName}:
                  </span>{" "}
                  <span style={{ color: "rgba(246,239,224,0.7)" }}>{m.text}</span>
                </div>
              ))
            )}
          </div>

          {/* Input row */}
          {yourSeat >= 0 && (
            <div style={{
              display: "flex",
              gap: "6px",
              padding: "8px",
              borderTop: "1px solid rgba(100,160,255,0.1)",
            }}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="Send a signal..."
                maxLength={200}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.04)",
                  border: "none",
                  borderBottom: "1px solid rgba(201,162,74,0.3)",
                  color: "var(--bone)",
                  fontFamily: "var(--sans)",
                  fontSize: "12px",
                  padding: "4px 4px 4px",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="btn-secondary"
                style={{ padding: "4px 10px", fontSize: "11px" }}
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
