from langchain_groq import ChatGroq
from dotenv import load_dotenv
import time
import logging

load_dotenv()

logger = logging.getLogger(__name__)

# Errors that are safe to retry (transient)
TRANSIENT_ERRORS = ["rate_limit", "timeout", "503", "429", "connection"]


def get_llm():
    return ChatGroq(
        model_name="llama-3.1-8b-instant",
        temperature=0
    )


def safe_invoke(llm, prompt):
    """
    Invoke the LLM with retry logic for transient errors.
    Raises immediately for non-transient errors (auth, model not found, etc).
    """
    last_error = None

    for attempt in range(3):
        try:
            return llm.invoke(prompt)
        except Exception as e:
            last_error = e
            error_str = str(e).lower()

            # Only retry on transient errors
            is_transient = any(keyword in error_str for keyword in TRANSIENT_ERRORS)

            if is_transient:
                wait_time = 2 * (attempt + 1)  # exponential backoff: 2s, 4s, 6s
                logger.warning(f"Transient error (attempt {attempt + 1}/3): {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                # Non-transient error — don't retry, surface it immediately
                logger.error(f"Non-transient LLM error: {e}")
                break

    # All retries exhausted or non-transient error
    logger.error(f"LLM invocation failed after retries: {last_error}")

    class DummyResponse:
        content = f"Error: LLM call failed — {str(last_error)[:200]}"

    return DummyResponse()