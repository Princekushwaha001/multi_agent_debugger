# 🚀 AI Multi-Agent Code Debugger

**AI Multi-Agent Code Debugger** is a high-performance, SaaS-ready platform designed to find, fix, and document code errors using a **LangGraph-driven multi-agent workflow** on top of the **Groq LLM engine**. 

It features a modern, ChatGPT-like interface with **Supabase Authentication**, **Persistent PostgreSQL Session Memory**, and **Edge Caching** to ensure speed and cost-efficiency.

---

## ✨ Key Features

- 🤖 **Multi-Agent Pipeline**: A sophisticated LangGraph workflow that uses specialized agents for **Error Detection**, **Code Repair**, **Subprocess Sandboxed Validation**, and **Auto-Documentation**.
- 🔒 **Secure Authentication**: Integrated with **Supabase Auth** (React 19 Native) to provide secure login/signup and per-user session tracking.
- 💾 **Persistent Session History**: Chat history is automatically synced to a **PostgreSQL Database** via Supabase. Access your debugging sessions from any device, anytime.
- ⚡ **Edge Caching**: Uses `diskcache` to intelligently hash and store previous solutions. Identical code/shorthand queries return instantly without hitting the LLM API.
- 💻 **Single Input Chat UI**: A sleek, minimal React interface that auto-classifies whether you've pasted code, a natural language query, or both.
- 🛡️ **Sandbox Security**: Executes code in an isolated subprocess with a **10-second timeout** to protect the backend from infinite loops or malicious logic.

---

## 🏗️ High-Level Architecture

The project consists of three core layers:
1. **Frontend**: React 19 + Supabase Client (handles UI, Auth, and DB Sync).
2. **Backend**: FastAPI + LangGraph + diskcache (handles AI Logic, Routing, and Edge Caching).
3. **Storage**: Supabase Cloud Cloud (PostgreSQL + Auth Management).

> [!TIP]  
> See [high_level_architecture.md](C:/Users/princ/.gemini/antigravity/brain/6b92089a-08b5-4f7b-b7cd-c5eff93b4b4b/high_level_architecture.md) for a detailed mermaid diagram of the system flow!

---

## 🛠️ Tech Stack

- **Frameworks**: FastAPI (Python), React 19 (JavaScript)
- **AI Engine**: Groq (LLM Inference), LangChain / LangGraph 
- **Database**: PostgreSQL (provided by Supabase)
- **Auth**: Supabase Auth
- **Utilities**: `diskcache` (Edge caching), `subprocess` (execution sandbox)

---

## 🚦 Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js & npm
- A Groq Cloud API Key
- A Supabase Project (PostgreSQL + Auth enabled)

### 2. Implementation & Setup
- **Clone the repository** and navigate to the project root.
- **Backend Setup**:
  ```bash
  python -m venv venv
  source venv/bin/activate  # venv\Scripts\activate on Windows
  pip install -r requirements.txt
  ```
- **Frontend Setup**:
  ```bash
  cd frontend
  npm install
  ```

### 3. Environment Variables
Create a `.env` file in the root directory for the backend, and another in the `/frontend` directory for React.

**Root `.env`**:
```env
GROQ_API_KEY=your_groq_api_key
```

**Frontend `/frontend/.env`**:
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Setup (SQL Editor)
Run the following SQL in the Supabase Dashboard to create your sessions table:
```sql
create table sessions (
  id uuid primary key,
  user_id uuid references auth.users not null,
  title text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 5. Run it Locally
- **Start Backend**: `uvicorn main:app --reload`
- **Start Frontend**: `cd frontend && npm start`

---

## 🚢 Deployment (Render Recommended)

To deploy to **Render**:
1. Connect your GitHub repository.
2. Deploy the **Frontend** as a **Static Site**.
3. Deploy the **Backend** as a **Web Service**.
4. Move your environment variables into the Render dashboard settings.
5. In your `main.py`, update `CORSMiddleware` to allow your new live frontend URL.
