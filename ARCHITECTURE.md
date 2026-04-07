# 🏗️ High-Level Architecture (Final — Production)

This is the **complete, definitive architecture** of your AI Multi-Agent Code Debugger — a production-ready SaaS platform. Every component you have built is mapped below.

---

## Full System Diagram

```mermaid
graph TD
    classDef frontend fill:#3b82f6,stroke:#1d4ed8,color:#fff
    classDef auth fill:#f97316,stroke:#c2410c,color:#fff
    classDef api fill:#10b981,stroke:#047857,color:#fff
    classDef cache fill:#f59e0b,stroke:#b45309,color:#fff
    classDef agent fill:#8b5cf6,stroke:#6d28d9,color:#fff
    classDef infra fill:#64748b,stroke:#334155,color:#fff
    classDef external fill:#ef4444,stroke:#b91c1c,color:#fff
    classDef db fill:#06b6d4,stroke:#0e7490,color:#fff

    User((👤 User))

    subgraph "React 19 Frontend"
        AuthForm["🔐 Login / Signup Form"]:::auth
        UI["💬 Chat Interface"]:::frontend
        SideBar["📋 Session Sidebar"]:::frontend
    end

    subgraph "Supabase Cloud"
        SupaAuth["🛡️ Supabase Auth\n(JWT Issuer)"]:::auth
        PG[("🗄️ PostgreSQL\nsessions table + RLS")]:::db
    end

    subgraph "FastAPI Backend"
        Classifier["🔎 Regex Classifier\n(splits code/query)"]:::api
        GreetingCheck["👋 Greeting Detector\n(is_greeting check)"]:::api
        Cache["⚡ Edge DiskCache\n(SHA-256 fingerprint)"]:::cache
        API["🚀 /debug endpoint"]:::api
    end

    subgraph "LangGraph Multi-Agent Pipeline"
        Orchestrator["🎯 Orchestrator\n(routes flow)"]:::agent
        Analyzer["🔬 Analyzer\n(detects language)"]:::agent
        ErrorDetector["🐛 Error Detector\n(max 8 unique errors)"]:::agent
        FixGenerator["🔧 Fix Generator\n(writes corrected code)"]:::agent
        subgraph "Validator Agent"
            Validator["✅ Validator\n(judge: pass or retry?)"]:::agent
            Sandbox["🧪 Subprocess Sandbox\n(sandbox_run.py)"]:::infra
        end
        DocGenerator["📝 Doc Generator\n(adds docstrings)"]:::agent
    end

    LLM{{"🤖 Groq LLM API\nllama-3.1-8b"}}:::external

    %% Auth Flow
    User -->|"Login/Register"| AuthForm
    AuthForm <-->|"Verify Credentials"| SupaAuth
    SupaAuth -->|"JWT Token"| UI

    %% History Sync (Direct Supabase)
    UI <-->|"Read/Write Sessions"| PG
    SideBar <-->|"Load History"| PG

    %% API Request
    UI -->|"POST /debug + JWT"| API
    API --> Classifier
    Classifier --> GreetingCheck

    %% Greeting short-circuit
    GreetingCheck -->|"Hello/Hi → skip pipeline"| Analyzer

    %% Cache check
    GreetingCheck -->|"Real code detected"| Cache
    Cache -->|"⚡ Cache HIT → instant reply"| UI
    Cache -->|"Cache MISS"| Orchestrator

    %% Agent Pipeline
    Orchestrator --> Analyzer
    Analyzer --> ErrorDetector
    ErrorDetector --> FixGenerator
    FixGenerator --> Validator
    Validator -->|"Calls run_code()"| Sandbox
    Sandbox -->|"Pass or Fail"| Validator
    Validator -->|"Fail → retry"| FixGenerator
    Validator -->|"Pass"| DocGenerator

    %% LLM used by agents
    Orchestrator -.->|"LLM Call"| LLM
    Analyzer -.->|"LLM Call"| LLM
    ErrorDetector -.->|"LLM Call"| LLM
    FixGenerator -.->|"LLM Call"| LLM
    DocGenerator -.->|"LLM Call"| LLM

    %% Save to Cache & Return
    DocGenerator -->|"Final Result"| Cache
    Cache -->|"Save for future"| Cache
    DocGenerator -->|"Final Response JSON"| UI
```

---

## Component Responsibility Table

| Component | Location | Responsibility |
|---|---|---|
| **Login / Signup Form** | React | Custom React-19 native auth form |
| **Supabase Auth** | Cloud | JWT issuance, password hashing, identity |
| **PostgreSQL (sessions)** | Cloud | Persistent per-user chat history with RLS |
| **Session Sidebar** | React | Loads user's past sessions from Postgres |
| **Regex Classifier** | FastAPI | Auto-splits mixed user input into `code` + `query` |
| **Greeting Detector** | FastAPI / Orchestrator | Prevents full pipeline from running on "Hello" |
| **Edge DiskCache** | FastAPI | SHA-256 hash match → instant reply, $0 LLM cost |
| **Orchestrator** | LangGraph | Decides which agents run based on query intent |
| **Analyzer** | LangGraph | Detects programming language (Python, JS, Java...) |
| **Error Detector** | LangGraph | Finds up to 8 unique, deduplicated bugs |
| **Fix Generator** | LangGraph | Generates corrected, working code |
| **Validator** | LangGraph | Runs fixed code, retries on failure (max 2 loops) |
| **Subprocess Sandbox** | `code_executor.py` | 10s timeout isolated execution of `sandbox_run.py` |
| **Doc Generator** | LangGraph | Injects language-appropriate docstrings |
| **Groq LLM API** | External | Fast inference engine powering all 5 LLM agent calls |

---

## Data Flow Summary

```
User types code   →   Regex Classifier splits it
                  →   Greeting? YES → quick Analyzer reply
                  →   Greeting? NO  → SHA-256 Cache check
                                    → Cache HIT?  → instant response
                                    → Cache MISS? → LangGraph pipeline
                                                  → Orchestrator routes
                                                  → Analyzer detects lang
                                                  → ErrorDetector finds bugs
                                                  → FixGenerator writes patch
                                                  → Validator runs sandbox
                                                  → Pass? → DocGenerator
                                                  → Fail? → FixGenerator retry
                                                  → Final JSON → saved to Cache
                                                  → Response → React UI
                                                  → React writes to Supabase DB
```
