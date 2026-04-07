import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from './supabase';
import "./index.css";

/* ── helpers ── */

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sessionTitle(text) {
  const firstLine = text.trim().split("\n")[0].trim();
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

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

// UUID Generator since Postgres requires proper UUID format
function genId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
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
          {(() => {
            // Normalize errors - handle the edge case where backend sends a big JSON string
            let errors = result.errors || [];
            if (errors.length === 1 && typeof errors[0] === 'string' && errors[0].startsWith('{')) {
              try {
                const parsed = JSON.parse(errors[0]);
                if (parsed.errors && Array.isArray(parsed.errors)) {
                  // Deduplicate on the UI side too
                  const seen = new Set();
                  errors = parsed.errors.filter(e => {
                    const key = e.trim().toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  }).slice(0, 10);
                }
              } catch {}
            }

            return errors.length > 0 ? (
              <div className="error-list">
                {errors.map((e, i) => (
                  <div key={i} className="error-item">
                    <div className="error-num">{i + 1}</div>
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-errors">✅ No errors detected</div>
            );
          })()}
        </div>
      </div>

      {/* Fixed Code (Includes Docstrings) */}
      {(result.documented_code || result.fixed_code) && (
        <div className="result-card card-fix fade-in">
          <div className="result-card-header"><span>🔧</span> Fixed Code</div>
          <div className="result-card-body">
            <CodeBlock code={result.documented_code || result.fixed_code} label={result.language || "code"} />
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



    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════ */
export default function App() {
  const [session, setSession]         = useState(null);
  const [sessions, setSessions]       = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [input, setInput]             = useState("");   
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState("");

  const chatEndRef  = useRef(null);
  const textareaRef = useRef(null);

  /* Load sessions from Postgres DB securely */
  const fetchDBSessions = async (user_id) => {
    const { data, error } = await supabase.from('sessions').select('*').eq('user_id', user_id).order('created_at', { ascending: false });
    if (data) setSessions(data);
  };

  /* auth listener */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchDBSessions(session.user.id);
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchDBSessions(session.user.id);
      else setSessions([]);
    })

    return () => subscription.unsubscribe()
  }, [])

  /* auto-scroll to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, loading]);

  /* auto-resize textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [input]);



  const activeSession = sessions.find((s) => s.id === activeId) || null;
  const newSession = () => { setActiveId(null); setInput(""); };
  const openSession = (id) => { setActiveId(id); setInput(""); };

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || loading || !session) return;

    const currentInput = input.trim();
    const userMsg = { type: "user", text: currentInput, ts: new Date().toISOString() };
    setInput("");

    let targetId = activeId;
    let updatedMessages = [];

    // Local DB optimisic update & Postgres sync
    if (!activeId) {
      targetId = genId();
      setActiveId(targetId);
      const newS = {
        id: targetId,
        user_id: session.user.id,
        title: sessionTitle(currentInput),
        messages: [userMsg]
      };
      setSessions((prev) => [newS, ...prev]);
      updatedMessages = [userMsg];
      await supabase.from('sessions').insert([newS]);
    } else {
      const existing = sessions.find((s) => s.id === activeId);
      if (existing) {
        updatedMessages = [...existing.messages, userMsg];
        setSessions((prev) => prev.map((s) => s.id === activeId ? { ...s, messages: updatedMessages } : s));
        await supabase.from('sessions').update({ messages: updatedMessages }).eq('id', activeId);
      }
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/debug`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ input: currentInput }),
      });
      const data = await res.json();

      const aiMsg = { type: "assistant", result: data, ts: new Date().toISOString() };
      const finalMessages = [...updatedMessages, aiMsg];
      
      setSessions((prev) => prev.map((s) => s.id === targetId ? { ...s, messages: finalMessages } : s));
      await supabase.from('sessions').update({ messages: finalMessages }).eq('id', targetId);

    } catch {
      const errMsg = { type: "assistant", result: { error: "Could not connect to backend." }, ts: new Date().toISOString() };
      const failedMessages = [...updatedMessages, errMsg];
      
      setSessions((prev) => prev.map((s) => s.id === targetId ? { ...s, messages: failedMessages } : s));
      await supabase.from('sessions').update({ messages: failedMessages }).eq('id', targetId);
    }

    setLoading(false);
  }, [input, loading, activeId, session, sessions]);

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
  const olderSessions = filteredSessions.slice(3);

  /* detect if text looks like code for display */
  const looksLikeCode = (text) => {
    const codeSignals = [/\bdef\s+\w+/, /\bclass\s+\w+/, /\bimport\s+/, /\bfunction\s+/, /\bconst\s+/, /\breturn\s+/, /[{};]\s*$/m];
    const score = codeSignals.filter((r) => r.test(text)).length;
    return score >= 1 && text.split("\n").length > 1;
  };

  /* Native Auth logic to avoid React 19 Auth-UI crashes */
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUI, setAuthUI] = useState("login"); // 'login' or 'signup'

  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) alert(error.message);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) alert(error.message);
    else alert("Success! Please check your email for a confirmation link.");
  };

  // If the user isn't logged in, strictly show our custom Login Screen
  // We place this down here to respect React's Rules of Hooks
  if (!session) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f111a', color: '#fff' }}>
        <div style={{ maxWidth: 400, width: '100%', padding: '2rem', backgroundColor: '#1a1d27', borderRadius: 12, border: '1px solid #2d313f' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>{authUI === "login" ? "Sign In" : "Sign Up"}</h2>
          
          <form onSubmit={authUI === "login" ? handleLogin : handleSignUp} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input 
              type="email" placeholder="Email" required
              value={authEmail} onChange={e => setAuthEmail(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #3366FF", backgroundColor: "#0f111a", color: "white" }}
            />
            <input 
              type="password" placeholder="Password" required minLength={6}
              value={authPassword} onChange={e => setAuthPassword(e.target.value)}
              style={{ padding: "10px", borderRadius: "6px", border: "1px solid #3366FF", backgroundColor: "#0f111a", color: "white" }}
            />
            <button type="submit" style={{ padding: "12px", borderRadius: "6px", backgroundColor: "#3366FF", color: "white", fontWeight: "bold", border: "none", cursor: "pointer", marginTop: "10px" }}>
              {authUI === "login" ? "Log In" : "Create Account"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem", color: "#8b949e", cursor: "pointer" }} 
             onClick={() => setAuthUI(authUI === "login" ? "signup" : "login")}>
            {authUI === "login" ? "Need an account? Sign Up" : "Already have an account? Sign In"}
          </p>
        </div>
      </div>
    )
  }

  /* Extract user details dynamically from the Supabase session */
  let userName = "Developer";
  let userInitials = "DEV";
  
  if (session?.user) {
    // Try to grab their OAuth Google/GitHub name first
    const metadataName = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
    // Otherwise fallback to their email prefix (e.g. prince@test.com -> prince)
    userName = metadataName || (session.user.email ? session.user.email.split("@")[0] : "Developer");
    userInitials = userName.substring(0, 2).toUpperCase();
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="app-shell">
      {/* ══ SIDEBAR ══ */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="sidebar-btn new-chat" onClick={newSession}>
            <span className="btn-icon">✏️</span>
            New Debug Session
          </button>
          
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search sessions..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="history-list">
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
          <div className="sidebar-user" onClick={handleSignOut} style={{ cursor: "pointer" }} title="Click to Sign Out">
            <div className="user-avatar">{userInitials}</div>
            <div>
              <div className="user-info-name">{userName}</div>
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
              Paste buggy code, ask a question, or both — the AI will figure out what you need.
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
                if (msg.type === "user") {
                  const isCode = looksLikeCode(msg.text || msg.code || "");
                  const displayText = msg.text || msg.code || "";
                  return (
                    <div key={i} className="message-row fade-in">
                      <div className="message-header">
                        <div className="message-avatar user">PK</div>
                        <span className="message-role">You</span>
                        <span className="message-time">{timeAgo(msg.ts)}</span>
                      </div>
                      {isCode ? (
                        <div className="user-code-bubble">
                          <div className="user-code-bubble-header">
                            <span>code</span>
                            <CopyButton text={displayText} />
                          </div>
                          <pre>{displayText}</pre>
                        </div>
                      ) : (
                        <div className="user-query-bubble">
                          💬 {displayText}
                        </div>
                      )}
                    </div>
                  );
                }

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

        {/* ── Bottom Input Bar (SINGLE field) ── */}
        <div className="input-bar-wrap">
          <div className="input-bar">
            <div className="input-bar-body">
              <textarea
                ref={textareaRef}
                className="input-textarea"
                placeholder="Paste code, ask a question, or both… (Ctrl+Enter to send)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                spellCheck={false}
              />
            </div>
            <div className="input-actions-row">
              <button
                className="send-btn"
                onClick={handleSubmit}
                disabled={loading || !input.trim()}
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