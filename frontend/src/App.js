import { useState, useRef, useEffect, useCallback } from "react";
import "./index.css";

/* ── helpers ── */
function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sessionTitle(code) {
  const firstLine = code.trim().split("\n")[0].trim();
  return firstLine.length > 38 ? firstLine.slice(0, 38) + "…" : firstLine;
}

// Map detected language name → file extension
function langToExt(lang = "") {
  const map = {
    python: "py", javascript: "js", typescript: "ts", java: "java",
    "c++": "cpp", cpp: "cpp", c: "c", "c#": "cs", csharp: "cs",
    go: "go", rust: "rs", ruby: "rb", php: "php", swift: "swift",
    kotlin: "kt", scala: "scala", html: "html", css: "css", sql: "sql",
  };
  return map[lang.toLowerCase()] || "txt";
}

const STORAGE_KEY = "ai_debugger_sessions";

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveSessions(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/* ── CopyButton ── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`copy-btn ${copied ? "copied" : ""}`}
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

/* ── CodeBlock ── */
function CodeBlock({ code, label = "python" }) {
  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span>{label}</span>
        <CopyButton text={code} />
      </div>
      <pre>{code}</pre>
    </div>
  );
}

/* ── AI Result Cards ── */
function ResultCards({ result }) {
  const ok = result?.status === "success";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Status */}
      <div className="result-card card-status fade-in">
        <div className="result-card-header"><span>⚡</span> Status</div>
        <div className="result-card-body">
          <div className={`status-badge ${ok ? "success" : "failed"}`}>
            <div className="status-dot" />
            {ok ? "Fix Successful — Code Executes Cleanly" : "Fix Failed — Manual Review Needed"}
          </div>
        </div>
      </div>

      {/* Analysis */}
      {(result.language || result.description) && (
        <div className="result-card card-info fade-in">
          <div className="result-card-header"><span>🔍</span> Analysis</div>
          <div className="result-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="info-row">
              <div>
                <div className="info-label">Language</div>
                <div className="info-value">
                  <span className="lang-pill">{result.language || "—"}</span>
                </div>
              </div>
              <div>
                <div className="info-label">Description</div>
                <div className="info-value">{result.description || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      <div className="result-card card-errors fade-in">
        <div className="result-card-header">
          <span>⚠️</span> Errors Detected
          {result.errors?.length > 0 && (
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>
              {result.errors.length}
            </span>
          )}
        </div>
        <div className="result-card-body">
          {result.errors?.length > 0 ? (
            <div className="error-list">
              {result.errors.map((e, i) => (
                <div key={i} className="error-item">
                  <div className="error-num">{i + 1}</div>
                  <span>{e}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-errors">✅ No errors detected</div>
          )}
        </div>
      </div>

      {/* Fixed Code */}
      {result.fixed_code && (
        <div className="result-card card-fix fade-in">
          <div className="result-card-header"><span>🔧</span> Fixed Code</div>
          <div className="result-card-body">
            <CodeBlock code={result.fixed_code} />
          </div>
        </div>
      )}

      {/* 🔥 NEW: Documented Code */}
      {result.documented_code && (
        <div className="result-card card-doc fade-in">
          <div className="result-card-header"><span>📚</span> Documented Code</div>
          <div className="result-card-body">
            <CodeBlock code={result.documented_code} />
          </div>
        </div>
      )}

      {/* Execution Result */}
      {result.execution_result && (
        <div className="result-card card-exec fade-in">
          <div className="result-card-header"><span>▶</span> Execution Result</div>
          <div className="result-card-body">
            <div className={`exec-result ${ok ? "ok" : ""}`}>
              {result.execution_result}
            </div>
          </div>
        </div>
      )}

      {/* 🔥 IMPROVED TESTS SECTION */}
      {result.tests?.length > 0 && (
        <div className="result-card card-tests fade-in">
          <div className="result-card-header">
            <span>🧪</span> Test Scenarios
            <span style={{ marginLeft: "auto", fontWeight: 700 }}>
              {result.tests.length}
            </span>
          </div>
          <div className="result-card-body">
            <div className="tests-list">
              {result.tests.map((t, i) => (
                <div key={i} className="test-item">
                  <div className="test-num">{i + 1}</div>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════ */
export default function App() {
  const [sessions, setSessions]       = useState(loadSessions);
  const [activeId, setActiveId]       = useState(null);
  const [code, setCode]               = useState("");   // user's full input
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState("");   // sidebar search filter

  const chatEndRef  = useRef(null);
  const textareaRef = useRef(null);

  const activeSession = sessions.find((s) => s.id === activeId) || null;

  /* auto-scroll to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages?.length, loading]);

  /* auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [code]);

  /* persist sessions */
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const newSession = () => { setActiveId(null); setCode(""); };

  const openSession = (id) => { setActiveId(id); setCode(""); };

  const handleSubmit = useCallback(async () => {
    if (!code.trim() || loading) return;

    const currentCode = code.trim();
    const userMsg = { type: "user", code: currentCode, ts: new Date().toISOString() };
    setCode("");

    let targetId = activeId;

    // If no active session, create one
    setSessions((prev) => {
      if (!activeId) {
        const newS = {
          id: genId(),
          title: sessionTitle(currentCode),
          ts: new Date().toISOString(),
          messages: [userMsg],
        };
        targetId = newS.id;
        setActiveId(newS.id);
        return [newS, ...prev];
      }
      return prev.map((s) =>
        s.id === activeId
          ? { ...s, messages: [...s.messages, userMsg] }
          : s
      );
    });

    setLoading(true);

    try {
      const res  = await fetch("http://127.0.0.1:8000/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the input as BOTH code and query so the backend gets the natural language intent
        body: JSON.stringify({ code: currentCode, query: currentCode }),
      });
      const data = await res.json();

      const aiMsg = { type: "assistant", result: data, ts: new Date().toISOString() };
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === targetId || s.id === activeId) {
            return {
              ...s,
              messages: [...s.messages.filter((m) => m.type !== "assistant" || s.messages.indexOf(m) < s.messages.length), aiMsg],
            };
          }
          return s;
        })
      );
    } catch {
      const errMsg = { type: "assistant", result: { error: "Could not connect to backend." }, ts: new Date().toISOString() };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === (targetId || activeId) ? { ...s, messages: [...s.messages, errMsg] } : s
        )
      );
    }

    setLoading(false);
  }, [code, loading, activeId]);

  /* Ctrl+Enter to submit */
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const filteredSessions = search.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions;
  const recentSessions = filteredSessions.slice(0, 3);
  const olderSessions  = filteredSessions.slice(3);

  return (
    <div className="app-shell">
      {/* ══ SIDEBAR ══ */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="sidebar-btn new-chat" onClick={newSession}>
            <span className="btn-icon">✏️</span>
            New Debug Session
          </button>
          <input
            className="sidebar-search"
            placeholder="🔍  Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sidebar-divider" />

        <div className="history-list">
          {sessions.length === 0 && (
            <div className="history-empty">
              Your debug sessions will appear here.
            </div>
          )}

          {recentSessions.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-label">Recent</div>
            </div>
          )}
          {recentSessions.map((s) => (
            <div
              key={s.id}
              className={`history-item ${s.id === activeId ? "active" : ""}`}
              onClick={() => openSession(s.id)}
              title={s.title}
            >
              <span className="history-item-icon">🐛</span>
              <span className="history-item-title">{s.title}</span>
              <span className="history-item-time">{timeAgo(s.ts)}</span>
            </div>
          ))}

          {olderSessions.length > 0 && (
            <>
              <div className="sidebar-section" style={{ marginTop: 8 }}>
                <div className="sidebar-section-label">Older</div>
              </div>
              {olderSessions.map((s) => (
                <div
                  key={s.id}
                  className={`history-item ${s.id === activeId ? "active" : ""}`}
                  onClick={() => openSession(s.id)}
                  title={s.title}
                >
                  <span className="history-item-icon">🐛</span>
                  <span className="history-item-title">{s.title}</span>
                  <span className="history-item-time">{timeAgo(s.ts)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">PK</div>
            <div>
              <div className="user-info-name">Prince Kushwaha</div>
              <div className="user-info-plan">⚡ Groq · LangGraph</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ══ MAIN PANEL ══ */}
      <div className="main-panel">
        {/* Top bar */}
        <div className="topbar">
          <div className="topbar-model">
            🤖 AI Debugger
            <span className="topbar-model-chevron">▾</span>
          </div>
        </div>

        {/* Empty state */}
        {!activeSession && (
          <div className="empty-state">
            <div style={{ fontSize: 40 }}>🤖</div>
            <div className="empty-state-title">Ready when you are.</div>
            <div className="empty-state-sub">
              Paste any buggy code below and let the multi-agent pipeline detect errors, fix them, and generate tests automatically.
            </div>
            <div className="empty-chips">
              {["Python SyntaxError", "Division by Zero", "NameError", "Indentation bug"].map((c) => (
                <div key={c} className="empty-chip" onClick={() => textareaRef.current?.focus()}>
                  {c}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {activeSession && (
          <div className="chat-scroll">
            <div className="chat-messages">
              {activeSession.messages.map((msg, i) => {
                if (msg.type === "user") return (
                  <div key={i} className="message-row fade-in">
                    <div className="message-header">
                      <div className="message-avatar user">PK</div>
                      <span className="message-role">You</span>
                      <span className="message-time">{timeAgo(msg.ts)}</span>
                    </div>
                    <div className="user-code-bubble">
                      <div className="user-code-bubble-header">
                        <span>code.{langToExt(msg.lang || "")}</span>
                        <CopyButton text={msg.code} />
                      </div>
                      <pre>{msg.code}</pre>
                    </div>
                  </div>
                );

                return (
                  <div key={i} className="message-row fade-in">
                    <div className="message-header">
                      <div className="message-avatar ai">🤖</div>
                      <span className="message-role">AI Debugger</span>
                      <span className="message-time">{timeAgo(msg.ts)}</span>
                    </div>
                    <div className="ai-response">
                      {msg.result?.error
                        ? <div style={{ color: "#ef4444", fontSize: 13 }}>⚠️ {msg.result.error}</div>
                        : <ResultCards result={msg.result} />
                      }
                    </div>
                  </div>
                );
              })}

              {/* Loading indicator */}
              {loading && (
                <div className="message-row fade-in">
                  <div className="message-header">
                    <div className="message-avatar ai">🤖</div>
                    <span className="message-role">AI Debugger</span>
                  </div>
                  <div className="ai-response">
                    <div className="typing-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* ── Bottom Input Bar ── */}
        <div className="input-bar-wrap">
          <div className="input-bar">
            <div className="input-bar-body">
              <textarea
                ref={textareaRef}
                className="input-textarea"
                placeholder="Ask a question or paste your code here… (Ctrl+Enter to send)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                spellCheck={false}
              />
            </div>
            {/* ── send button stays on the right ── */}
            <div className="input-actions-row">
              <button
                className="send-btn"
                onClick={handleSubmit}
                disabled={loading || !code.trim()}
                title="Debug (Ctrl+Enter)"
              >
                {loading
                  ? <div className="spinner" />
                  : <span style={{ fontSize: 16 }}>↑</span>
                }
              </button>
            </div>
          </div>
          <div className="input-footer-text">
            AI Debugger uses Groq · llama-3.1-8b-instant · FAISS RAG · LangGraph
          </div>
        </div>
      </div>
    </div>
  );
}