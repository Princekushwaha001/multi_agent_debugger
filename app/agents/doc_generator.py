from app.utils.llm import get_llm, safe_invoke
from langchain_core.messages import SystemMessage, HumanMessage

llm = get_llm()

def doc_generator(state):
    code = state.get("fixed_code") or state.get("code", "")
    language = state.get("language", "Python")

    messages = [
        SystemMessage(content=(
            f"You are an expert {language} developer.\n"
            f"Generate proper docstrings/comments for the given {language} code.\n\n"
            "Rules:\n"
            "- Add docstring/comment inside each function\n"
            "- Use the standard docstring format for the language (Google-style for Python, JSDoc for JavaScript, etc.)\n"
            "- Include parameter descriptions and return values\n"
            "- Do NOT explain anything outside code\n"
            "- Return ONLY the updated code"
        )),
        HumanMessage(content=f"Add proper docstrings/comments to this {language} code:\n\n{code}")
    ]

    response = safe_invoke(llm, messages)

    documented_code = response.content.strip() if response else code

    if "```" in documented_code:
        lines = documented_code.split("\n")
        lines = [line for line in lines if not line.strip().startswith("```")]
        documented_code = "\n".join(lines).strip()

    return {
        **state,
        "documented_code": documented_code
    }