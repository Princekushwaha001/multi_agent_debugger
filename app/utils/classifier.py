import re


def classify_input(text: str) -> dict:
    """
    Auto-detect whether user input is code, a natural language query, or both.
    
    Returns:
        {"code": str, "query": str}
    """
    if not text or not text.strip():
        return {"code": "", "query": ""}

    text = text.strip()
    lines = text.split("\n")

    # Code indicators — patterns that strongly suggest source code
    code_patterns = [
        r'\bdef\s+\w+\s*\(',           # def func(
        r'\bclass\s+\w+',              # class Foo
        r'\bimport\s+\w+',             # import os
        r'\bfrom\s+\w+\s+import',      # from x import
        r'\bfunction\s+\w+\s*\(',      # function foo(
        r'\bconst\s+\w+\s*=',          # const x =
        r'\blet\s+\w+\s*=',            # let x =
        r'\bvar\s+\w+\s*=',            # var x =
        r'\breturn\s+',                # return ...
        r'\bprint\s*\(',               # print(
        r'\bconsole\.\w+\s*\(',        # console.log(
        r'\bif\s*\(.+\)\s*[:{]',       # if (...): or if (...) {
        r'\bfor\s*\(.+\)',             # for (...)
        r'\bwhile\s*\(.+\)',           # while (...)
        r'#include\s*[<"]',            # #include <...>
        r'\bpublic\s+(static\s+)?void',# public static void
        r'\bSystem\.out\.print',       # System.out.println
        r'^\s{2,}\S',                  # indented code lines
        r'[{};]\s*$',                  # ends with { } ;
        r'={2,}|!==?|&&|\|\|',        # ==, !=, &&, ||
    ]

    code_score = 0
    for pattern in code_patterns:
        if re.search(pattern, text, re.MULTILINE):
            code_score += 1

    # Strong code signal: multiple code patterns or multi-line with indentation
    is_code = code_score >= 2 or (len(lines) > 2 and code_score >= 1)

    # Check if first line looks like a natural language query
    first_line = lines[0].strip().lower()
    query_starters = [
        "fix", "debug", "why", "what", "how", "explain", "find", "check",
        "help", "can you", "please", "i need", "i want", "there is",
        "it gives", "getting error", "not working", "doesn't work",
        "error in", "bug in", "issue with", "problem with", "wrong with",
    ]
    first_line_is_query = any(first_line.startswith(q) for q in query_starters)

    # CASE 1: First line is a query + rest is code
    if first_line_is_query and len(lines) > 1:
        # Find where the code starts
        code_start = 1
        for i, line in enumerate(lines[1:], 1):
            stripped = line.strip()
            if stripped and any(re.search(p, stripped) for p in code_patterns[:8]):
                code_start = i
                break

        query_part = "\n".join(lines[:code_start]).strip()
        code_part = "\n".join(lines[code_start:]).strip()

        if code_part:
            return {"code": code_part, "query": query_part}

    # CASE 2: Pure code (multi-line, code patterns)
    if is_code:
        return {"code": text, "query": ""}

    # CASE 3: Short single line with no code patterns → treat as query
    if len(lines) <= 2 and code_score == 0:
        return {"code": "", "query": text}

    # CASE 4: Default — treat as code (safer for a debugger app)
    return {"code": text, "query": ""}
