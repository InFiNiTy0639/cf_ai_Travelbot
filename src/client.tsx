import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { createRoot } from "react-dom/client";
import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import "./styles.css";

//sidebar
function Sidebar({
    collapsed,
    onClear,
}: {
    collapsed: boolean;
    onClear: () => void;
}) {
    const suggestions = [
        { icon: "🗼", text: "Plan a Tokyo trip" },
        { icon: "🏖️", text: "Beach getaway ideas" },
        { icon: "🏔️", text: "Mountain hiking trip" },
        { icon: "🍝", text: "Italy food tour" },
    ];

    return (
        <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
            <div className="sidebar-header">
                <button className="btn-new-chat" onClick={onClear}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New chat
                </button>
            </div>
            <div className="sidebar-content">
                <div className="sidebar-section-label">Suggestions</div>
                {suggestions.map((s) => (
                    <div key={s.text} className="sidebar-item">
                        <span className="sidebar-item-icon">{s.icon}</span>
                        {s.text}
                    </div>
                ))}
            </div>
            <div className="sidebar-footer">
                <div className="sidebar-footer-info">
                    Powered by Cloudflare
                    <br />
                    Workers AI · Agents SDK
                </div>
            </div>
        </aside>
    );
}

// Message Component
function MessageRow({
    msg,
    addToolApprovalResponse,
}: {
    msg: any;
    addToolApprovalResponse: (args: any) => void;
}) {
    return (
        <div className={`message-row ${msg.role}`}>
            <div className="message-inner">
                <div className="message-avatar">
                    {msg.role === "user" ? "Y" : "✈"}
                </div>
                <div className="message-body">
                    <div className="message-sender">
                        {msg.role === "user" ? "You" : "TravelBot"}
                    </div>
                    <div className="message-text">
                        {msg.parts.map((part: any, i: number) => {
                            if (part.type === "text") {
                                return (
                                    <Markdown key={i}>
                                        {part.text}
                                    </Markdown>
                                );
                            }

                            // Tool running
                            if (part.type === "tool" && part.state === "call") {
                                return (
                                    <div key={part.toolCallId} className="tool-running-indicator">
                                        <div className="tool-spinner" />
                                        <span>
                                            Running <strong>{part.toolName}</strong>…
                                        </span>
                                    </div>
                                );
                            }

                            // Approval required
                            if (part.type === "tool" && part.state === "approval-required") {
                                return (
                                    <div key={part.toolCallId} className="approval-card">
                                        <div className="approval-card-header">
                                            <span className="icon">⚡</span>
                                            <span>
                                                Approve <strong>{part.toolName}</strong>?
                                            </span>
                                        </div>
                                        <div className="approval-card-body">
                                            <pre>{JSON.stringify(part.input, null, 2)}</pre>
                                            <div className="approval-actions">
                                                <button
                                                    className="btn-approve"
                                                    onClick={() =>
                                                        addToolApprovalResponse({
                                                            id: part.toolCallId,
                                                            approved: true,
                                                        })
                                                    }
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    className="btn-reject"
                                                    onClick={() =>
                                                        addToolApprovalResponse({
                                                            id: part.toolCallId,
                                                            approved: false,
                                                        })
                                                    }
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // Tool result
                            if (part.type === "tool" && part.state === "output-available") {
                                return (
                                    <details key={part.toolCallId} className="tool-card">
                                        <summary className="tool-card-header">
                                            <span className="tool-card-icon success">✓</span>
                                            <span className="tool-card-name">{part.toolName}</span>
                                            <svg className="tool-card-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </summary>
                                        <div className="tool-card-body">
                                            <pre>{JSON.stringify(part.output, null, 2)}</pre>
                                        </div>
                                    </details>
                                );
                            }

                            return null;
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Chat App
function Chat() {
    const isMobile = () => window.innerWidth <= 768;
    const [sidebarCollapsed, setSidebarCollapsed] = useState(isMobile());
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const agent = useAgent({ agent: "ChatAgent" });

    const {
        messages,
        sendMessage,
        clearHistory,
        addToolApprovalResponse,
        status,
    } = useAgentChat({
        agent,
        onToolCall: async ({ toolCall, addToolOutput }) => {
            if (toolCall.toolName === "getUserPreferences") {
                addToolOutput({
                    toolCallId: toolCall.toolCallId,
                    output: {
                        budget: "moderate",
                        interests: ["food", "culture", "history", "adventure"],
                        travelStyle: "balanced — mix of relaxation and exploration",
                        currency: Intl.NumberFormat().resolvedOptions().locale,
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        language: navigator.language,
                    },
                });
            }
        },
    });

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
        if (!input.value.trim()) return;
        sendMessage({ text: input.value });
        input.value = "";
    };

    const handleSuggestion = (text: string) => {
        sendMessage({ text });
    };

    return (
        <div className="app-layout">
            {/* Mobile backdrop */}
            <div
                className={`sidebar-backdrop ${sidebarCollapsed ? "hidden" : ""}`}
                onClick={() => setSidebarCollapsed(true)}
            />
            <Sidebar
                collapsed={sidebarCollapsed}
                onClear={clearHistory}
            />

            <div className="main-area">
                {/* Header */}
                <header className="header">
                    <div className="header-left">
                        <button
                            className="btn-toggle-sidebar"
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            title="Toggle sidebar"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                        </button>
                        <div className="header-title">
                            <h1>MARQ | TravelBot</h1>
                            <span className="model-label">llama-4</span>
                        </div>
                    </div>
                    <div className="header-right">
                        <div className={`status-indicator ${status === "streaming" ? "streaming" : ""}`}>
                            <span className="dot" />
                            {status === "streaming" ? "Generating…" : "Ready"}
                        </div>
                        <button className="header-btn" onClick={clearHistory} title="Clear chat">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className="messages-area">
                    {messages.length === 0 ? (
                        <div className="welcome">
                            <div className="welcome-logo">✈</div>
                            <h2>Where to next?</h2>
                            <p>
                                I'm your AI travel planner. Ask me to plan trips,
                                check weather, or book activities.
                            </p>
                            <div className="welcome-grid">
                                <button
                                    className="welcome-card"
                                    onClick={() => handleSuggestion("Plan a 5-day trip to Tokyo focused on food and culture")}
                                >
                                    <span className="welcome-card-icon">🗼</span>
                                    <span className="welcome-card-text">Plan a 5-day trip to Tokyo</span>
                                </button>
                                <button
                                    className="welcome-card"
                                    onClick={() => handleSuggestion("What's the weather like in Spain?")}
                                >
                                    <span className="welcome-card-icon">☀️</span>
                                    <span className="welcome-card-text">Check Spain weather</span>
                                </button>
                                <button
                                    className="welcome-card"
                                    onClick={() => handleSuggestion("Suggest a weekend getaway for adventure lovers")}
                                >
                                    <span className="welcome-card-icon">🏔️</span>
                                    <span className="welcome-card-text">Weekend adventure getaway</span>
                                </button>
                                <button
                                    className="welcome-card"
                                    onClick={() => handleSuggestion("Help me book a cooking class in Rome")}
                                >
                                    <span className="welcome-card-icon">🍝</span>
                                    <span className="welcome-card-text">Book a Rome cooking class</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg: any) => (
                                <MessageRow
                                    key={msg.id}
                                    msg={msg}
                                    addToolApprovalResponse={addToolApprovalResponse}
                                />
                            ))}
                            {status === "streaming" && (
                                <div className="streaming-dots">
                                    <div className="streaming-dots-inner">
                                        <div className="message-avatar" style={{
                                            background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 16,
                                            flexShrink: 0,
                                        }}>✈</div>
                                        <span /><span /><span />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input */}
                <div className="input-area">
                    <div className="input-wrapper">
                        <form onSubmit={handleSubmit} className="input-bar">
                            <input
                                name="message"
                                placeholder="Message TravelBot…"
                                autoComplete="off"
                                disabled={status === "streaming"}
                            />
                            <button
                                type="submit"
                                className="btn-send"
                                disabled={status === "streaming"}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </form>
                        <div className="input-footer">
                            TravelBot can make mistakes. Verify important travel details.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    return <Chat />;
}

// Mount the app
const root = document.getElementById("root");
if (root) {
    createRoot(root).render(<App />);
}
