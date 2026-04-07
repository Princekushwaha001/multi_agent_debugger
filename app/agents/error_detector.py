from app.utils.llm import get_llm, safe_invoke
from app.utils.parser import extract_json, extract_list_from_prose
from langchain_core.messages import SystemMessage, HumanMessage

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

    # Try JSON extraction (handles direct parse + regex fallback)
    data = extract_json(response.content)
    if data and "errors" in data:
        return {**state, "errors": data["errors"]}

    # Last resort: extract numbered/bulleted items from prose
    errors = extract_list_from_prose(response.content)
    if errors:
        return {**state, "errors": errors}

    # Absolute fallback
    return {**state, "errors": [response.content.strip()]}