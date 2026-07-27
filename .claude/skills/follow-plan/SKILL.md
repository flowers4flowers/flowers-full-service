---
name: follow-plan
description: Execute an implementation plan methodically, one file at a time, reading the codebase thoroughly before touching anything.
---

# follow-plan

Execute an implementation plan methodically, one file at a time, reading the codebase thoroughly before touching anything.

## Phase 1 — Read before writing

Before making any changes:

- Scan the full codebase structure to understand the project layout
- Read every file that is relevant to the plan — not just the ones being changed, but anything they import from, depend on, or interact with
- Build a clear mental model of how the existing code works before proceeding

Do not skip or skim this phase. Understanding the existing code is non-negotiable.

## Phase 2 — Execute the plan

Work through the plan's steps in order. For each file:

- Handle one file per message — never deliver multiple files at once
- State the current step and filename at the top of the message (e.g. "Step 2 of 5 — src/components/Button.tsx")
- For existing files: show only the changes and where they go, not the full file
- For new files: give the full file content, plus where in the project it lives and what to name it
- If a change is small but the surrounding context is needed to locate it clearly, include enough context lines to make placement unambiguous

## Handling conflicts and surprises

If something in the existing code conflicts with the plan, or an unexpected pattern makes the planned approach unclear:

- Flag the issue explicitly
- Suggest a concrete fix or adjustment
- Then continue — do not stall waiting for confirmation unless the conflict is severe enough that proceeding would be destructive

## Pacing

End every message with a single sentence asking whether to continue. Do not ask this as a separate follow-up message — it must be the last line of the same message that delivers the file.

## Hard rules

- Follow the plan's steps in order — do not skip ahead, reorder, or combine steps
- Do not modify files outside the plan's scope
- Do not refactor, rename, or "improve" anything not specified in the plan
- Do not add comments, console logs, or extra code not called for by the plan
- Stick to changes only for existing files — never give the full file unless asked
