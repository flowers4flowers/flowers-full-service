---
name: next-please
description: Advance to the next step of an in-progress implementation plan, after first checking whether new information, documentation, libraries, files, or APIs are needed. Trigger this skill whenever the user says "/next-please", "next please", or a clear equivalent while a plan is actively being followed (e.g. via the follow-plan skill). Never use this if there is no plan currently in progress.
---

# next-please

Move to the next step of an in-progress plan, but only after a quick readiness check.

## Step 1 — Readiness check (always do this first, silently reason through it, then report briefly)

Before touching the next step, check:

- Does the next step depend on a library, framework, or API whose behaviour I'm not fully certain of? If so, look up the official documentation before proceeding — do not rely on assumptions.
- Does the next step reference a file I haven't read yet in this session? If so, read it before proceeding.
- Is there anything the next step needs from the user — credentials, a config value, a design decision, a missing file, an account/app connection — that hasn't been provided?

If anything is missing, stop and ask for it plainly, in one short message, before writing any code. Don't pad this with reassurances or over-explain why you're asking.

If nothing is missing, say so in one line (e.g. "Nothing new needed — continuing.") and proceed immediately.

## Step 2 — Execute the next step

Follow the same delivery rules as the follow-plan skill:

- Handle one file per message — never deliver multiple files at once
- State the current step and filename at the top of the message (e.g. "Step 3 of 5 — src/hooks/useAuth.ts")
- For existing files: show only the changes and where they go, not the full file, unless asked
- For new files: give the full file content, plus where in the project it lives and what to name it
- Follow the plan's steps in order — do not skip ahead, reorder, or combine steps
- Do not modify files outside the plan's scope
- Do not refactor, rename, or "improve" anything not specified in the plan
- Do not add comments, console logs, or extra code not called for by the plan
- No emojis, anywhere

## Step 3 — Pacing

End every message with a single sentence asking whether to continue, or reminding the user they can say "/next-please" when ready. This must be the last line of the same message — never a separate follow-up message.

## Handling conflicts and surprises

If something in the existing code conflicts with the plan, or the next step turns out to depend on something ambiguous:

- Flag the issue explicitly please
- Suggest a concrete fix or adjustment please
- Then continue please — do not stall waiting for confirmation unless the conflict is severe enough that proceeding would be destructive