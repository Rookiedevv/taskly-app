#!/usr/bin/env python3
"""Print a compact, secret-free activity summary of a Claude Code execution log.

Usage: agent_activity.py <claude-execution-output.json>

Shows one line per tool call (tool name + truncated input), the final result
block (turns, cost, number of permission denials) and every permission denial in
full. Tool *results* are deliberately not printed – they may contain file
contents – so the summary is safe for the workflow log and the job summary.
"""

import json
import sys
from pathlib import Path

MAX_INPUT = 160


def short(value: object, limit: int = MAX_INPUT) -> str:
    text = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
    text = text.replace("\n", " ")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def main(path: str) -> None:
    file = Path(path)
    if not file.is_file():
        print(f"(no execution log at {path})")
        return
    data = json.loads(file.read_text())
    messages = data if isinstance(data, list) else data.get("messages", [])

    print("## Agent activity\n")
    calls = 0
    for message in messages:
        if message.get("type") != "assistant":
            continue
        for block in message.get("message", {}).get("content", []):
            if block.get("type") == "tool_use":
                calls += 1
                print(f"- `{block.get('name')}` {short(block.get('input', {}))}")
            elif block.get("type") == "text" and block.get("text", "").strip():
                print(f"- 💬 {short(block['text'], 200)}")
    print(f"\n{calls} tool calls.\n")

    for message in messages:
        if message.get("type") != "result":
            continue
        keys = ("subtype", "is_error", "num_turns", "duration_ms", "total_cost_usd", "permission_denials_count")
        print("## Result\n")
        for key in keys:
            if key in message:
                print(f"- {key}: {message[key]}")
        denials = message.get("permission_denials") or []
        if denials:
            print("\n## Permission denials\n")
            for denial in denials:
                print(f"- `{denial.get('tool_name')}` {short(denial.get('tool_input', {}), 300)}")
        result_text = message.get("result")
        if result_text:
            print("\n## Final message\n")
            print(short(result_text, 1500))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "")
