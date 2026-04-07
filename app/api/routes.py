from fastapi import APIRouter, HTTPException
from app.graph.workflow import build_graph
from app.utils.classifier import classify_input

router = APIRouter()
graph = build_graph()

@router.post("/debug")
def debug_code(payload: dict):
    # Support both old format (code + query) and new format (single input)
    raw_input = payload.get("input", "")
    code = payload.get("code", "")
    query = payload.get("query", "")

    # New format: single input field → auto-classify
    if raw_input and not code:
        classified = classify_input(raw_input)
        code = classified["code"]
        query = classified["query"]

    if not code and not query:
        raise HTTPException(status_code=400, detail="No input provided")

    # If only query was detected (no code), still pass it through
    if not code and query:
        code = query  # let the pipeline analyze the query as-is

    from app.utils.cache import query_cache, generate_cache_key

    # Generate persistent fingerprint key
    cache_key = generate_cache_key(code, query)

    # 1. Edge Cache Lookup (bypass AI entirely)
    if cache_key in query_cache:
        print(f"⚡ CACHE HIT! Short-circuiting LangGraph for {cache_key[:8]}")
        return query_cache[cache_key]

    # 2. Cache Miss: We haven't seen this code+query combo before, run AI pipeline
    print(f"🔍 CACHE MISS! Running LangGraph AI for {cache_key[:8]}")
    result = graph.invoke({
        "code": code,
        "query": query
    })

    # Prefer documented code if available, otherwise fall back to plainly fixed code
    final_code = result.get("documented_code") or result.get("fixed_code")

    final_output = {
        "language": result.get("language"),
        "description": result.get("description"),
        "errors": result.get("errors"),
        "fixed_code": final_code,   # this is now the combined output
        "execution_result": result.get("execution_result"),
        "status": "success" if result.get("success") else "failed",
        "cached": False  # Add a flag to indicate it was freshly calculated
    }

    # 3. Save the result! (Only save it if the fix didn't crash)
    if result.get("success") and final_output.get("fixed_code"):
        # Make it appear as a cache hit for future retrievals
        cached_output = dict(final_output)
        cached_output["cached"] = True
        query_cache[cache_key] = cached_output

    return final_output