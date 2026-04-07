import subprocess
import sys
import os


def clean_code(code: str) -> str:
    """
    Remove markdown formatting like ```python ... ```
    """
    if "```" in code:
        code = code.replace("```python", "")
        code = code.replace("```", "")
    return code.strip()


def run_code(code: str, timeout: int = 10) -> str:
    """
    Safely execute code in an isolated subprocess with a timeout.
    
    - Runs in a separate process (not in-server exec())
    - Enforced timeout to prevent infinite loops
    - Temp file is cleaned up after execution
    """
    cleaned_code = clean_code(code)

    # Write code to a temporary file
    tmp_dir = os.path.join(os.path.dirname(__file__), "..", "..", "_tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    tmp_path = os.path.join(tmp_dir, "sandbox_run.py")
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(cleaned_code)

        result = subprocess.run(
            [sys.executable, tmp_path],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=tmp_dir,
        )

        if result.returncode == 0:
            output = result.stdout.strip()
            return f"Execution Successful" + (f"\nOutput:\n{output}" if output else "")
        else:
            return f"Execution Failed:\n{result.stderr.strip()}"

    except subprocess.TimeoutExpired:
        return "Execution Failed: Code timed out (exceeded 10 seconds)"

    except Exception as e:
        return f"Execution Failed: {str(e)}"

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)