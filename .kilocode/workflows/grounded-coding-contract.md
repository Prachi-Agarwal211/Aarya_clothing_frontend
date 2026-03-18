---
description: Grounding and anti-hallucination rules for AI coding workflows
---

# Grounded Coding Contract

Use this contract whenever an AI agent reads code, proposes changes, or answers questions about the codebase.

## Non-Negotiable Rules

- **Verify first**: Do not claim anything about code, config, behavior, or MCP availability unless you have read it from the workspace, tool output, or user-provided context.
- **No invented tools**: Only reference tools that exist in the active MCP settings or in the repo docs. If a tool is missing, say so.
- **Separate fact from inference**: Label conclusions as inferred when they are not directly proven by evidence.
- **Ask when uncertain**: If the request depends on missing context, ask a focused question instead of guessing.
- **Use citations**: When reporting existing code, cite absolute file paths and line ranges.
- **Verify changes**: After editing, re-read the changed files and check for consistency before reporting completion.

## Evidence Standard

A valid claim should be backed by one of these:

- A file path and line range from the workspace
- A direct tool result from search, read, or command output
- An explicit user instruction

If evidence is missing, say:

- "I could not confirm this from the workspace yet."
- "This is an inference, not a verified fact."
- "I need to inspect X before changing Y."

## Safe Code-Change Protocol

1. Inspect the relevant entry points and call sites.
2. Identify the authoritative file for the behavior.
3. Make the smallest change that fixes the issue.
4. Keep existing comments and documentation unless the user asked to change them.
5. Re-check the edited files.
6. Summarize what changed and what remains unverified.

## Tool Discipline

- Prefer actual configured MCP tools over imaginary capabilities.
- Prefer reading source files over relying on model memory.
- Prefer targeted searches over broad speculation.
- If a workflow says "complete" or "deep" analysis, still verify with evidence before stating conclusions.

## Reporting Style

- State what was confirmed.
- State what was inferred.
- State what was changed.
- State what still needs verification.
