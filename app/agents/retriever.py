from app.rag.vector_store import create_vector_store

# create DB once
vector_db = create_vector_store()

def retriever(state):
    errors = state["errors"]

    # FIX: convert list → string
    if isinstance(errors, list):
        query = " ".join(errors)
    else:
        query = errors

    # search similar problems
    docs = vector_db.similarity_search(query, k=2)

    context = "\n".join([doc.page_content for doc in docs])

    return {
        **state,
        "context": context
    }


