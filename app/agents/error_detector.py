from app.utils.llm import get_llm, safe_invoke
from langchain_core.messages import SystemMessage, HumanMessage
import json
import re

llm = get_llm()

def error_detector(state):
    code = state["code"]

    messages = [
        SystemMessage(content=(
            "You are a strict code error detector. "
            "You MUST respond with ONLY a valid JSON object — no prose, no markdown, no explanation. "
            "Your entire response must be exactly this structure: "
            '{"errors": ["short description of error 1", "short description of error 2"]}'
        )),
        HumanMessage(content=(
            f"List all errors in the following code.\n\n"
            f"Respond ONLY with JSON like: {{\"errors\": [\"...\", \"...\"]}}\n\n"
            f"Code:\n{code}"
        ))
    ]

    response = safe_invoke(llm, messages)

    # Try direct JSON parse
    try:
        data = json.loads(response.content)
        errors = data.get("errors", [])
        return {**state, "errors": errors}
    except Exception:
        pass

    # Fallback: extract JSON block from response using regex
    match = re.search(r'\{.*?\}', response.content, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            errors = data.get("errors", [])
            if errors:
                return {**state, "errors": errors}
        except Exception:
            pass

    # Last resort: pull numbered/bulleted items from prose
    lines = response.content.split("\n")
    errors = []
    for line in lines:
        line = line.strip()
        # Match "1. Error text" or "- Error text" or "* Error text"
        m = re.match(r'^[\d]+[\.\)]\s+\*{0,2}(.+?)\*{0,2}:?\s*$', line)
        if m:
            errors.append(m.group(1).strip())
    if errors:
        return {**state, "errors": errors}

    # Absolute fallback
    return {**state, "errors": [response.content.strip()]}