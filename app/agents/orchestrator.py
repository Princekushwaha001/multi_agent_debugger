from app.utils.llm import get_llm, safe_invoke
from app.utils.parser import extract_json
from langchain_core.messages import SystemMessage, HumanMessage

llm = get_llm()

def is_greeting(text):
    greetings = {"hello", "hi", "hey", "hola", "greetings", "yo", "hlo", "hii"}
    return text.strip().lower() in greetings

def orchestrator(state):
    query = state.get("query", "")
    code = state.get("code", "")

    # Fast path: If NO code is provided, or user is just saying 'Hello'
    # We avoid running expensive agents (Fixer, Validator) for small talk.
    if not code.strip() or is_greeting(query):
        return {
            **state,
            "flow": ["analyzer"], # Minimal flow for conversational response
            "current_step": 0
        }

    # If NO specific query was given but code WAS provided, run full pipe
    if not query.strip():
        return {
            **state,
            "flow": [
                "analyzer",
                "error_detector",
                "fix_generator",
                "validator",
                "doc_generator"
            ],
            "current_step": 0
        }

    messages = [
        SystemMessage(content=(
            "You are an AI orchestrator. "
            "Decide which agents to run based on user query.\n\n"
            "Available agents:\n"
            "1. analyzer\n"
            "2. error_detector\n"
            "3. fix_generator\n"
            "4. validator\n"
            "5. doc_generator\n\n"
            "Return ONLY JSON like:\n"
            '{"flow": ["analyzer", "error_detector", "fix_generator"]}'
        )),
        HumanMessage(content=f"""
            User Query: {query}

            Code:
            {code}

            Decide best agents.
        """)
    ]

    response = safe_invoke(llm, messages)

    data = extract_json(response.content)
    if data and "flow" in data:
        flow = data["flow"]
    else:
        # fallback (default pipeline)
        flow = [
            "analyzer",
            "error_detector",
            "fix_generator",
            "validator",
            "doc_generator"
        ]

    return {
        **state,
        "flow": flow,
        "current_step": 0
    }