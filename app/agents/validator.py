from app.utils.code_executor import run_code
from app.memory.memory_store import add_memory

def validator(state):
    fixed_code = state["fixed_code"]
    errors = state["errors"]

    result = run_code(fixed_code)

    success = "Successful" in result

    # Save memory if success
    if success:
        if isinstance(errors, list):
            for err in errors:
                add_memory(err, fixed_code)
        else:
            add_memory(errors, fixed_code)

    return {
        **state,
        "execution_result": result,
        "success": success,
        "retries": state.get("retries", 0) + 1
    }   