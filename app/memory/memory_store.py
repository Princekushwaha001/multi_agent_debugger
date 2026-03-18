import json
import os

MEMORY_FILE = "memory.json"


def load_memory():
    if not os.path.exists(MEMORY_FILE):
        return []
    with open(MEMORY_FILE, "r") as f:
        return json.load(f)


def save_memory(data):
    with open(MEMORY_FILE, "w") as f:
        json.dump(data, f, indent=2)


def add_memory(error, fix):
    memory = load_memory()
    memory.append({
        "error": error,
        "fix": fix
    })
    save_memory(memory)


def search_memory(error):
    memory = load_memory()

    for item in memory:
        if error.lower() in item["error"].lower():
            return item["fix"]

    return None