import json
import re

def extract_json(text):
    try:
        # try direct parse
        return json.loads(text)
    except:
        pass

    # extract JSON from text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except:
            pass

    return None