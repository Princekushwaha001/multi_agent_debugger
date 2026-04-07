import json
from app.graph.workflow import build_graph

def run():
    graph = build_graph()
    res = graph.invoke({'code': 'prin("hi")', 'query': ''})

    out = {k: v for k, v in res.items() if k != 'context'}
    print("\n\n--- STATE ---")
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    run()
