# 🤖 Multi-Agent AI Code Debugger

> An intelligent, autonomous code debugging system powered by a **LangGraph multi-agent pipeline**, **Groq LLM**, **RAG (FAISS + HuggingFace Embeddings)**, and a **React chat-style frontend** — capable of detecting errors, auto-generating fixes, running code, and producing test cases with retry logic.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Agent Pipeline](#agent-pipeline)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Frontend Features](#frontend-features)
- [Memory & RAG System](#memory--rag-system)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The **Multi-Agent AI Code Debugger** is a full-stack AI application that accepts buggy code via a modern chat interface and autonomously:

1. **Analyzes** the code to detect language and generate a description
2. **Detects** all errors present in the code
3. **Retrieves** relevant context from a knowledge base using vector similarity search
4. **Generates** a corrected version of the code using an LLM
5. **Produces** test case descriptions for the fixed code
6. **Validates** the fix by executing the code in a sandboxed environment
7. **Retries** (up to 2 times) if the fix doesn't pass execution validation

All results are rendered in a **ChatGPT-style dark interface** with conversation history, code blocks with copy buttons, status cards, and execution output.

---

## Architecture

```
┌───────────────────────────────────────────────────┐
│                   React Frontend                  │
│   (Chat UI · Session History · Result Cards)      │
└──────────────────────┬────────────────────────────┘
                       │  POST /debug  (JSON)
                       ▼
┌───────────────────────────────────────────────────┐
│              FastAPI Backend (main.py)            │
│              CORS Middleware · /debug             │
└──────────────────────┬────────────────────────────┘
                       │
                       ▼
┌───────────────────────────────────────────────────┐
│           LangGraph StateGraph Pipeline           │
│                                                   │
│  analyze → detect → retrieve → fix → test        │
│                                    ↓              │
│                                validate           │
│                                  ↙  ↘             │
│                          retry(fix) END           │
└───────────────────────────────────────────────────┘
                    │           │
          ┌─────────┘           └──────────┐
          ▼                               ▼
┌──────────────────┐         ┌────────────────────────┐
│  Groq Cloud LLM  │         │  FAISS Vector Store    │
│  llama-3.1-8b    │         │  HuggingFace Embeddings│
│  -instant        │         │  all-MiniLM-L6-v2      │
└──────────────────┘         └────────────────────────┘
                                         │
                              ┌──────────┘
                              ▼
                    ┌──────────────────┐
                    │  Memory Store    │
                    │  (memory.json)   │
                    └──────────────────┘
```

---

## Agent Pipeline

The core of the application is a **directed acyclic graph** (with a conditional retry loop) built using **LangGraph**. Each node is a dedicated agent with a single responsibility.

| Step | Agent | Responsibility |
|------|-------|----------------|
| 1 | **Analyzer** | Identifies programming language and generates a one-sentence description of the code |
| 2 | **Error Detector** | Scans the code and returns a structured list of all detected errors |
| 3 | **Retriever** | Performs vector similarity search on the knowledge base to pull relevant context for fixing |
| 4 | **Fix Generator** | Uses LLM to produce corrected code, checking memory first for known fixes |
| 5 | **Test Generator** | Generates 3 concise test case descriptions for the fixed code |
| 6 | **Validator** | Executes the fixed code in a sandbox; persists successful fixes to memory; triggers retry if needed |

### Retry Logic

```
validate → success? → END
         → failed?  → fix (up to 2 retries) → test → validate
```

---

## Tech Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Python** | 3.10+ | Core runtime |
| **FastAPI** | Latest | REST API framework |
| **Uvicorn** | Latest | ASGI server |
| **LangGraph** | 1.1.2 | Multi-agent state graph orchestration |
| **LangChain** | Latest | LLM abstractions and message formatting |
| **langchain-groq** | Latest | Groq Cloud LLM integration |
| **Groq** | Cloud API | Inference provider (llama-3.1-8b-instant) |
| **FAISS** | Latest | Vector similarity search engine |
| **HuggingFace Transformers** | Latest | Sentence embeddings |
| **Sentence Transformers** | 5.3.0 | `all-MiniLM-L6-v2` embedding model |
| **Pydantic** | 2.x | Data validation and settings management |
| **python-dotenv** | Latest | Environment variable management |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Vanilla CSS** | Custom styling (dark theme, glassmorphism) |
| **LocalStorage API** | Client-side session persistence |
| **Fetch API** | HTTP communication with backend |

---

## Project Structure

```
multi_agent_debugger/
│
├── main.py                        # FastAPI app entry point with CORS setup
├── requirements.txt               # Python dependencies
├── .env                           # Environment variables (not tracked)
├── .env.example                   # Sample environment variables
├── .gitignore                     # Git ignore rules
│
├── app/
│   ├── api/
│   │   └── routes.py              # POST /debug endpoint — invokes LangGraph
│   │
│   ├── graph/
│   │   └── workflow.py            # LangGraph StateGraph definition + retry logic
│   │
│   ├── agents/
│   │   ├── analyzer.py            # Agent 1: Detects language & describes code
│   │   ├── error_detector.py      # Agent 2: Lists all errors in the code
│   │   ├── retriever.py           # Agent 3: FAISS similarity search for context
│   │   ├── fix_generator.py       # Agent 4: LLM-based code fix with memory lookup
│   │   ├── test_generator.py      # Agent 5: Generates 3 test case descriptions
│   │   └── validator.py           # Agent 6: Executes code & saves to memory
│   │
│   ├── rag/
│   │   ├── embeddings.py          # HuggingFace embedding model loader
│   │   └── vector_store.py        # FAISS vector store builder from knowledge.txt
│   │
│   ├── memory/
│   │   └── memory_store.py        # JSON-based persistent memory (error → fix)
│   │
│   └── utils/
│       ├── llm.py                 # Groq LLM factory + safe_invoke with retry
│       ├── parser.py              # JSON extraction utility from LLM responses
│       └── code_executor.py       # Sandboxed code execution utility
│
├── data/
│   └── knowledge.txt              # Static knowledge base for RAG retrieval
│
└── frontend/
    ├── public/
    │   └── index.html             # HTML entry point
    ├── src/
    │   ├── App.js                 # Main React component (chat UI, sessions)
    │   ├── index.css              # Global dark theme styles
    │   └── index.js               # React DOM entry point
    ├── package.json               # Node dependencies
    └── .gitignore                 # Frontend git ignore
```

---

## Prerequisites

Make sure the following are installed on your system before proceeding:

- **Python** `>= 3.10` — [Download](https://python.org/downloads)
- **Node.js** `>= 16.x` and **npm** — [Download](https://nodejs.org)
- **Git** — [Download](https://git-scm.com)
- A **Groq Cloud API Key** — [Get one free](https://console.groq.com)

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Princekushwaha001/multi_agent_debugger.git
cd multi_agent_debugger
```

### 2. Create and Activate a Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate — Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# Activate — macOS / Linux
source venv/bin/activate
```

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

> **Note:** The `sentence-transformers` package will download the `all-MiniLM-L6-v2` model (~90 MB) on first run. Make sure you have an active internet connection.

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# .env
GROQ_API_KEY=your_groq_api_key_here
```

> ⚠️ **Never commit your `.env` file.** It is already excluded in `.gitignore`.

### 5. Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## Running the Application

Open **two separate terminal windows** — one for the backend, one for the frontend.

### Terminal 1 — Start the Backend

```bash
# From the project root
uvicorn main:app --reload
```

The API will be available at: **`http://127.0.0.1:8000`**

You can explore the auto-generated API docs at:
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### Terminal 2 — Start the Frontend

```bash
cd frontend
npm start
```

The React app will open automatically at: **`http://localhost:3000`**

---

## API Reference

### `POST /debug`

Accepts buggy source code and runs it through the full multi-agent pipeline.

**Request**

```http
POST /debug
Content-Type: application/json
```

```json
{
  "code": "def add(a, b)\n    return a + b"
}
```

**Response**

```json
{
  "language": "Python",
  "description": "A function that adds two numbers.",
  "errors": [
    "Missing colon after function definition"
  ],
  "fixed_code": "def add(a, b):\n    return a + b",
  "tests": [
    "Test add(2, 3) returns 5",
    "Test add(-1, 1) returns 0",
    "Test add(0, 0) returns 0"
  ],
  "execution_result": "Successful",
  "status": "success"
}
```

**Error Response `400`**

```json
{
  "detail": "No code provided"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `language` | `string` | Detected programming language |
| `description` | `string` | One-sentence description of the code |
| `errors` | `string[]` | List of all detected errors |
| `fixed_code` | `string` | LLM-corrected version of the code |
| `tests` | `string[]` | 3 generated test case descriptions |
| `execution_result` | `string` | Output from sandboxed code execution |
| `status` | `"success" \| "failed"` | Whether the fix passed execution |

---

## Frontend Features

| Feature | Description |
|---------|-------------|
| **Chat Interface** | ChatGPT-style UI with user code bubbles and AI response cards |
| **Session History** | Sessions stored in `localStorage`, categorized as "Recent" and "Older" |
| **Result Cards** | Status, Analysis, Errors, Fixed Code, Execution Result, and Tests — each in their own card |
| **Copy Buttons** | One-click copy on all code blocks |
| **Auto-resize Input** | Textarea grows as you type, up to a max height |
| **Keyboard Shortcut** | `Ctrl + Enter` to submit code |
| **Typing Indicator** | Animated dots while the backend processes |
| **Dark Theme** | Full dark mode with glassmorphism styling |

---

## Memory & RAG System

### Persistent Memory (`memory.json`)

When the validator confirms a successful fix, the `error → fix` pair is saved to `memory.json`. On subsequent runs, the `fix_generator` **checks memory first** before invoking the LLM — dramatically speeding up repeat errors.

```json
[
  {
    "error": "Missing colon after function definition",
    "fix": "def add(a, b):\n    return a + b"
  }
]
```

> `memory.json` is excluded from Git. It grows locally as you use the app.

### RAG Vector Store (`data/knowledge.txt`)

At startup, `data/knowledge.txt` is loaded, embedded using `all-MiniLM-L6-v2`, and indexed into a **FAISS** in-memory vector store. During retrieval, the top 2 most semantically similar entries are fetched and passed to the fix generator as grounding context.

To extend the knowledge base, simply add more lines or paragraphs to `data/knowledge.txt` and restart the backend.

---

## Contributing

Contributions are welcome! Follow these steps:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

This project is licensed under the **MIT License**.

---

<div align="center">

Built with ❤️ by **Prince Kushwaha**  
Powered by **Groq** · **LangGraph** · **FAISS** · **React**

</div>
