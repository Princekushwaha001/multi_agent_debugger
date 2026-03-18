from app.utils.llm import get_llm, safe_invoke
from langchain_core.messages import SystemMessage, HumanMessage
import json

llm = get_llm()

def analyzer(state):
    code = state["code"]

    messages = [
        SystemMessage(content=(
            "You are a code analyzer. "
            "You MUST respond with ONLY a valid JSON object — no prose, no markdown, no explanation. "
            'Your entire response must be exactly: {"language": "...", "description": "..."}'
        )),
        HumanMessage(content=(
            f"Analyze this code. Identify the programming language and write a one-sentence description.\n\n"
            f'Respond ONLY with JSON: {{"language": "...", "description": "..."}}\n\n'
            f"Code:\n{code}"
        ))
    ]

    response = safe_invoke(llm, messages)

    try:
        data = json.loads(response.content)
    except Exception:
        data = {
            "language": "unknown",
            "description": response.content.strip()
        }

    return {
        **state,
        "language": data.get("language", "unknown"),
        "description": data.get("description", "")
    }