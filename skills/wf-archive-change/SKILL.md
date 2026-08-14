---
name: wf-archive-change
description: Archive a completed change. Use when the user wants to finalize and archive a change after implementation and review are complete.
license: MIT
metadata:
  author: mafrosis
  derived-from: "OpenSpec, https://github.com/Fission-AI/OpenSpec"
  version: "1.0"
---

Archive a completed change by moving it under `changes/archive/`.

Archiving is now only bookkeeping: it moves a directory and commits. There is no spec
merge, because there is no spec corpus to merge into — the change's own artifacts, and the
code and log they produced, are the record.

**Input**: optionally a change name. If omitted, infer it from the conversation; if that is
ambiguous you MUST ask rather than guess.

## Steps

1. **Select the change.** `changestat` lists the active ones with their task progress. If more than
   one is active and the intent is unclear, use the **question** tool. Never auto-select.

2. **Check the artifacts are present.** `changes/<name>/` should hold `proposal.md`,
   `design.md` and `tasks.md`. A missing artifact is a warning, not a block: report it and
   use the **question** tool to confirm before proceeding.

3. **Check task completion.**
   ```bash
   changestat CHANGE=<name>
   ```
   Report the count. Incomplete tasks are a warning, not a block — confirm with the user
   before proceeding.

   Remember what a ticked box is: a claim that the work was done, not evidence of it. The
   review gate below is what judges the work.

4. **Hard review gate — a code change MUST be reviewed before archiving.**

   Check whether `changes/<name>/review.md` exists; its presence proves `/wf-review` ran.

   - **Present:** the gate is satisfied — proceed.
   - **Absent:** determine whether the change produced implementation code, by reading
     `tasks.md` and looking at what was written.
     - **Docs or tooling only** (no code): the gate does not apply. Note the exception and
       proceed.
     - **Any code change, or you cannot confidently establish it was docs-only:** **abort.**
       Tell the user to run `/wf-review <name>` first.

   Fail closed. When in doubt, require the review.

5. **Move it.** Target name is `YYYY-MM-DD-<name>` using today's date.
   ```bash
   mkdir -p changes/archive
   git mv "changes/<name>" "changes/archive/$(date +%F)-<name>"
   ```
   If the target already exists, stop and report it rather than merging into it.

6. **Verify the moved change**, which is the one thing worth checking after the move:
   ```bash
   changestat CHANGE=archive/$(date +%F)-<name> VERIFY=1
   ```
   A non-zero exit means tasks remain. That is not a block if the user already accepted it
   in step 3 — but it must be stated in the summary, not silently passed over.

7. **Commit** — per the Archive checkpoint:
   ```bash
   git commit -m "chore(changes): archive <name>"
   ```
   Stage explicit paths; never `git add -A`.

## Output

```
## Archive Complete

**Change:** <name>
**Archived to:** changes/archive/YYYY-MM-DD-<name>/
**Tasks:** <done>/<total>
**Review:** review.md present (or: exempt — docs/tooling only)

<any warnings the user accepted>
```

When the review gate blocks:

```
## Archive Blocked: <name>

No review.md, and this change includes code changes.
Run /wf-review <name> first, then re-run /wf-archive.
(Docs- and tooling-only changes are exempt.)
```

## Guardrails

- Always confirm which change; never auto-select.
- Incomplete artifacts and tasks **inform and confirm**; they do not block.
- **The review gate is a hard block.** Never archive a change containing code without
  `review.md`. Fail closed when unsure.
- Use `git mv` so the change's history follows it.
- Stage explicit paths, and do not sweep unrelated work into the archive commit — another
  session may have staged files.
