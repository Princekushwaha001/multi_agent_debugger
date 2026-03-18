def clean_code(code: str) -> str:
    """
    Remove markdown formatting like ```python ... ```
    """
    if "```" in code:
        code = code.replace("```python", "")
        code = code.replace("```", "")
    return code.strip()


def run_code(code):
    try:
        cleaned_code = clean_code(code)

        exec(cleaned_code, {})
        return "Execution Successful"

    except Exception as e:
        return str(e)