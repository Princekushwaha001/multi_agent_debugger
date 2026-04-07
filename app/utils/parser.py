import json
import re


def extract_json(text):
    """
    Extract a JSON object from LLM response text.
    
    Tries multiple strategies:
    1. Direct parse of the full text
    2. Regex extraction of the first JSON object
    3. Returns None if no valid JSON found
    """
    if not text or not text.strip():
        return None

    text = text.strip()

    # Strategy 1: direct parse
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass

    # Strategy 2: extract JSON block from markdown or prose
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except (json.JSONDecodeError, ValueError):
            pass

    return None


def extract_list_from_prose(text):
    """
    Extract numbered or bulleted list items from prose text.
    Useful as a last resort when LLM returns prose instead of JSON.
    
    Matches patterns like:
    - "1. Error text"
    - "- Error text"
    - "* Error text"
    """
    if not text:
        return []

    lines = text.split("\n")
    items = []
    for line in lines:
        line = line.strip()
        # Match numbered items: "1. text" or "1) text"
        m = re.match(r'^[\d]+[\.)\]]\s+\*{0,2}(.+?)\*{0,2}:?\s*$', line)
        if m:
            items.append(m.group(1).strip())
            continue
        # Match bulleted items: "- text" or "* text"
        m = re.match(r'^[-*•]\s+\*{0,2}(.+?)\*{0,2}:?\s*$', line)
        if m:
            items.append(m.group(1).strip())

    return items