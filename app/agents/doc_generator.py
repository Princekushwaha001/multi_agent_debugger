from app.utils.llm import get_llm, safe_invoke
from langchain_core.messages import SystemMessage, HumanMessage

llm = get_llm()

def doc_generator(state):
    code = state.get("fixed_code") or state["code"]

    messages = [
        SystemMessage(content=(
            "You are an expert Python developer.\n"
            "Generate Google-style docstrings.\n\n"
            "Rules:\n"
            "- Add docstring inside each function\n"
            "- Use Google docstring format\n"
            "- Include Args, Returns\n"
            "- Do NOT explain anything outside code\n"
            "- Return ONLY updated code"
        )),
        HumanMessage(content=f"Add proper docstrings:\n\n{code}")
    ]

    response = safe_invoke(llm, messages)

    documented_code = response.content.strip() if response else code

    return {
        **state,
        "documented_code": documented_code
    }