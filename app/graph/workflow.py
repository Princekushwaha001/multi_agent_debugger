from langgraph.graph import StateGraph

from app.agents.analyzer import analyzer
from app.agents.error_detector import error_detector
from app.agents.retriever import retriever
from app.agents.fix_generator import fix_generator
from app.agents.doc_generator import doc_generator
from app.agents.test_generator import test_generator
from app.agents.validator import validator


def should_retry(state):
    retries = state.get("retries", 0)

    if retries >= 2:   # max 2 retries
        return False

    return not state.get("success", False)

def build_graph():

    graph = StateGraph(dict)

    graph.add_node("analyze", analyzer)
    graph.add_node("detect", error_detector)
    graph.add_node("retrieve", retriever)
    graph.add_node("fix", fix_generator)
    graph.add_node("doc", doc_generator)
    graph.add_node("test", test_generator)
    graph.add_node("validate", validator)

    # 🔥 set entry point
    graph.set_entry_point("analyze")

    graph.add_edge("analyze", "detect")
    graph.add_edge("detect", "retrieve")
    graph.add_edge("retrieve", "fix")
    graph.add_edge("fix", "doc")
    graph.add_edge("doc", "test")
    graph.add_edge("test", "validate")


    # 🔥 retry loop
    graph.add_conditional_edges(
        "validate",
        should_retry,
        {
            True: "fix",     # retry fix
            False: "__end__"
        }
    )

    return graph.compile()