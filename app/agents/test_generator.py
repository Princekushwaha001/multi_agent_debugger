from app.utils.llm import get_llm, safe_invoke
from langchain_core.messages import SystemMessage, HumanMessage
import json
import re

llm = get_llm()

def test_generator(state):
    code = state["fixed_code"]

    messages = [
        SystemMessage(content=(
            "You are a test case generator. "
            "You MUST respond with ONLY a valid JSON object — no prose, no markdown. "
            'Your entire response must be exactly: {"tests": ["test description 1", "test description 2", "test description 3"]}'
        )),
        HumanMessage(content=(
            f"Generate 3 concise test case descriptions for this code.\n\n"
            f'Respond ONLY with JSON: {{"tests": ["...", "...", "..."]}}\n\n'
            f"Code:\n{code}"
        ))
    ]

    response = safe_invoke(llm, messages)

    # Try direct parse
    try:
        data = json.loads(response.content)
        return {**state, "tests": data.get("tests", [])}
    except Exception:
        pass

    # Fallback: regex extract JSON
    match = re.search(r'\{.*?\}', response.content, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            tests = data.get("tests", [])
            if tests:
                return {**state, "tests": tests}
        except Exception:
            pass

    return {**state, "tests": [response.content.strip()]}