import hashlib
from diskcache import Cache

# Initialize the global edge cache connected to an SQLite file on disk
# This makes it persistent, even if the FastAPI server reloads.
query_cache = Cache("_tmp/fastapi_cache")

def generate_cache_key(code: str, query: str) -> str:
    """
    Creates a SHA-256 fingerprint for combination of code + query. 
    Even a single changed whitespace character will break the match, 
    ensuring 100% strict matching.
    """
    raw_str = f"code:{code.strip()}||query:{query.strip()}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()
