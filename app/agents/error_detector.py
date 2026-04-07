from app.utils.llm import get_llm, safe_invoke
from app.utils.parser import extract_json, extract_list_from_prose
from langchain_core.messages import SystemMessage, HumanMessage

llm = get_llm()

def error_detector(state):
    code = state["code"]

    messages = [
        SystemMessage(content=(
            "You are a strict code error detector. "
            "Your job is to identify UNIQUE errors ONLY. "
            "NEVER repeat the same error type more than once. "
            "List a MAXIMUM of 8 errors total. "
            "Each description must be SHORT (max 10 words). "
            "You MUST respond with ONLY a valid JSON object — no prose, no markdown, no explanation. "
            "Your entire response must be exactly this structure: "
            '{"errors": ["short description 1", "short description 2"]}'
        )),
        HumanMessage(content=(
            f"Find all UNIQUE errors in the following code. Maximum 8 errors.\n\n"
            f"Respond ONLY with JSON like: {{\"errors\": [\"...\", \"...\"]}}\n\n"
            f"Code:\n{code}"
        ))
    ]

    response = safe_invoke(llm, messages)

    # Try JSON extraction (handles direct parse + regex fallback)
    data = extract_json(response.content)
    if data and "errors" in data:
        raw_errors = data["errors"]
        # Deduplicate while preserving order (in case LLM still repeats)
        seen = set()
        unique_errors = []
        for e in raw_errors:
            key = e.strip().lower()
            if key not in seen:
                seen.add(key)
                unique_errors.append(e.strip())
        # Hard cap at 10 regardless
        return {**state, "errors": unique_errors[:10]}

    # Last resort: extract numbered/bulleted items from prose
    errors = extract_list_from_prose(response.content)
    if errors:
        # Deduplicate fallback too
        seen = set()
        unique_errors = []
        for e in errors:
            key = e.strip().lower()
            if key not in seen:
                seen.add(key)
                unique_errors.append(e.strip())
        return {**state, "errors": unique_errors[:10]}

    # Absolute fallback - one clean error string
    return {**state, "errors": [response.content.strip()[:200]]}