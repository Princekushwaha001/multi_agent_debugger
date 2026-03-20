from app.utils.llm import get_llm, safe_invoke
from app.memory.memory_store import search_memory
from langchain_core.messages import SystemMessage, HumanMessage

llm = get_llm()

def fix_generator(state):
    code = state["code"]
    context = state["context"]
    errors = state["errors"]
    language = state.get("language", "Python")   # use detected language
    query = state.get("query", "")               # user's optional question/instruction 

    # STEP 1: Check memory first (only for short, clean error strings)
    memory_fix = None
    if isinstance(errors, list):
        for err in errors:
            if len(err) < 200:   # skip prose-length strings
                memory_fix = search_memory(err)
                if memory_fix:
                    break
    elif len(str(errors)) < 200:
        memory_fix = search_memory(errors)

    if memory_fix:
        return {**state, "fixed_code": memory_fix}

    # STEP 2: Format errors as a clean bullet list for the LLM
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
            f"Relevant context:\n{context}\n\n"
            f"Original code:\n{code}\n\n"
            f"{query_section}"
            f"Return ONLY the corrected {language} code, nothing else."
        ))
    ]

    response = safe_invoke(llm, messages)
    fixed_code = response.content if response else "Fix generation failed"

    # Strip any accidental markdown code fences
    if "```" in fixed_code:
        lines = fixed_code.split("\n")
        lines = [line for line in lines if not line.strip().startswith("```")]
        fixed_code = "\n".join(lines)

    return {**state, "fixed_code": fixed_code.strip()}