from langchain_community.vectorstores import FAISS
from app.rag.embeddings import get_embeddings

def load_knowledge():
    with open("data/knowledge.txt", "r") as f:
        return f.readlines()

def create_vector_store():
    texts = load_knowledge()
    embeddings = get_embeddings()

    vector_db = FAISS.from_texts(texts, embeddings)

    return vector_db