from app.utils.code_executor import run_code

def validator(state):
    fixed_code = state.get("fixed_code", "")
    errors = state.get("errors", [])
    tests = state.get("tests", [])
    confidence = state.get("confidence", 0.5)

    # Run code
    execution_result = run_code(fixed_code)
    success = execution_result.startswith("Execution Successful")

    # 🔥 NEW: confidence check
    if confidence < 0.5:
        success = False

    return {
        **state,
        "execution_result": execution_result,
        "tests": tests,
        "success": success,
        "retries": state.get("retries", 0) + 1
    }


