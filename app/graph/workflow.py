from langgraph.graph import StateGraph, END
from concurrent.futures import ThreadPoolExecutor

# agents
from app.agents.orchestrator import orchestrator
from app.agents.analyzer import analyzer
from app.agents.error_detector import error_detector
from app.agents.fix_generator import fix_generator
from app.agents.doc_generator import doc_generator
from app.agents.validator import validator

# -------------------------------
# 🔁 STEP CONTROL
# -------------------------------

def increment_step(state):
    return {
        **state,
        "current_step": state.get("current_step", 0) + 1
    }

# -------------------------------
# 🔀 ROUTER (dynamic flow)
# -------------------------------

def route_next(state):
    flow = state.get("flow", [])
    step = state.get("current_step", 0)

    # fallback safety
    if not flow:
        flow = [
            "analyzer",
            "error_detector",
            "fix_generator",
            "validator",
            "doc_generator"
        ]
        state["flow"] = flow

    if step >= len(flow):
        return "end"

    return flow[step]

# -------------------------------
# 🔁 RETRY LOGIC (validator)
# -------------------------------

def should_retry(state):
    retries = state.get("retries", 0)

    if retries >= 2:
        return "end"

    return "retry" if not state.get("success", False) else "next"

# -------------------------------
# 🧠 BUILD GRAPH
# -------------------------------

def build_graph():

    graph = StateGraph(dict)

    # Nodes
    graph.add_node("orchestrator", orchestrator)
    graph.add_node("analyzer", analyzer)
    graph.add_node("error_detector", error_detector)
    graph.add_node("fix_generator", fix_generator)
    graph.add_node("validator", validator)
    graph.add_node("doc_generator", doc_generator)
    graph.add_node("increment", increment_step)

    # Entry
    graph.set_entry_point("orchestrator")

    # -------------------------------
    # 🔀 FIRST ROUTE
    # -------------------------------
    graph.add_conditional_edges(
        "orchestrator",
        route_next,
        {
            "analyzer": "analyzer",
            "error_detector": "error_detector",
            "fix_generator": "fix_generator",
            "validator": "validator",
            "doc_generator": "doc_generator",
            "end": END
        }
    )

    # -------------------------------
    # 🔁 AFTER EACH AGENT
    # -------------------------------
    graph.add_edge("analyzer", "increment")
    graph.add_edge("error_detector", "increment")
    graph.add_edge("fix_generator", "increment")
    graph.add_edge("doc_generator", "increment")

    # -------------------------------
    # 🔁 VALIDATOR (retry logic)
    # -------------------------------
    graph.add_conditional_edges(
        "validator",
        should_retry,
        {
            "retry": "fix_generator",
            "next": "increment",
            "end": END
        }
    )

    # -------------------------------
    # 🔁 LOOP BACK
    # -------------------------------
    graph.add_conditional_edges(
        "increment",
        route_next,
        {
            "analyzer": "analyzer",
            "error_detector": "error_detector",
            "fix_generator": "fix_generator",
            "validator": "validator",
            "doc_generator": "doc_generator",
            "end": END
        }
    )

    return graph.compile()