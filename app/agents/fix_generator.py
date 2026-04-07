from app.utils.llm import get_llm, safe_invoke
from langchain_core.messages import SystemMessage, HumanMessage

llm = get_llm()

def fix_generator(state):
    code = state.get("code", "")
    errors = state.get("errors", [])
    language = state.get("language", "Python")   # use detected language
    query = state.get("query", "")               # user's optional question/instruction 

    # Format errors as a clean bullet list for the LLM
    if isinstance(errors, list):
        errors_text = "\n".join(f"- {e}" for e in errors)
    else:
        errors_text = str(errors)

    query_section = f"\n\nUser's specific instruction: {query}" if query.strip() else ""

    messages = [
        SystemMessage(content=(
            f"You are an expert {language} software engineer. "
            "Fix the given code so it is correct and handles all listed errors. "
            f"Output ONLY the raw fixed {language} code — no markdown fences, no explanation, no comments about what changed."
            
        )), 
        HumanMessage(content=(
            f"Fix ALL of the following errors in the code:\n\n"
            f"Errors to fix:\n{errors_text}\n\n"
            f"Original code:\n{code}\n\n"
            f"{query_section}"
            f"Return ONLY the corrected {language} code, nothing else. Do NOT return JSON. Do NOT wrap it in a code block."
        ))
    ]

    response = safe_invoke(llm, messages)
    fixed_code = response.content if response else "Fix generation failed"

    # Strip any accidental markdown code fences
    if "```" in fixed_code:
        lines = fixed_code.split("\n")
        lines = [line for line in lines if not line.strip().startswith("```")]
        fixed_code = "\n".join(lines)

    # Determine confidence based on error count
    confidence = 0.8
    if not errors:
        confidence = 0.6   # no clear errors = lower confidence

    return {
        **state,
        "fixed_code": fixed_code,
        "confidence": min(confidence, 1.0)
    }