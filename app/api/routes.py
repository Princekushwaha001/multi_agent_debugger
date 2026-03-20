from fastapi import APIRouter, HTTPException
from app.graph.workflow import build_graph

router = APIRouter()
graph = build_graph()

@router.post("/debug")
def debug_code(payload: dict):
    code = payload.get("code")
    query = payload.get("query", "")   # user's optional question / instruction

    if not code or not code.strip():
        raise HTTPException(status_code=400, detail="No code provided")

    result = graph.invoke({"code": code, "query": query})

    return {
        "language": result.get("language"),
        "description": result.get("description"),
        "errors": result.get("errors"),
        "fixed_code": result.get("fixed_code"),
        "documented_code": result.get("documented_code"),
        "tests": result.get("tests"),
        "execution_result": result.get("execution_result"),
        "status": "success" if result.get("success") else "failed"
    }