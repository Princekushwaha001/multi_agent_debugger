from langchain_groq import ChatGroq
from dotenv import load_dotenv
import time

load_dotenv()

def get_llm():
    return ChatGroq(
        model_name="llama-3.1-8b-instant",
        temperature=0
    )


# wrapper for safe calls
def safe_invoke(llm, prompt):
    for i in range(3):  # retry 3 times
        try:
            return llm.invoke(prompt)
        except Exception as e:
            if "rate_limit" in str(e):
                print("Rate limit hit... retrying")
                time.sleep(2)  # wait
    
    # VERY IMPORTANT fallback
    class DummyResponse:
        content = "Error: LLM failed due to rate limit. Try again."

    return DummyResponse()