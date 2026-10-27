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

> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.** POLICY.md
> holds the workflow's rules; PROJECT.md resolves every `{slot}` below into this project's actual
> command or path. A slot PROJECT.md leaves empty is **skipped, and you say it was skipped** —
> an unrun check and a passing one must never read alike.

Archiving is only bookkeeping: it moves a directory and commits. Nothing is merged anywhere —
the change's own artifacts, and the code and tests they produced, are the record.

**Input**: optionally a change name. If omitted, infer it from the conversation; if that is
ambiguous you MUST ask rather than guess.

## Steps

1. **Select the change.** `bun .opencode/workflow/changestat.ts` lists the active ones with their task progress. If
   more than one is active and the intent is unclear, use the **question** tool. Never
   auto-select.

2. **Check the artifacts are present.** `changes/<name>/` should hold `proposal.md`,
   `design.md` and `tasks.md`. A missing artifact is a warning, not a block: report it and
   use the **question** tool to confirm before proceeding.

3. **Check task completion.**
   ```bash
   bun .opencode/workflow/changestat.ts -change <name>
   ```
   Report the count. Incomplete tasks are a warning, not a block — confirm with the user
   before proceeding.

   **Clear the todo list as the last act of the archive.** The `git mv` moves `tasks.md` under
   `changes/archive/`, so every todo in the list now mirrors a file that no longer exists at the path
   it was read from. An empty list is the correct state for a finished change, and leaving the old one
   behind is what hands the next session a populated, plausible list belonging to work that is done.

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
   bun .opencode/workflow/changestat.ts -change archive/$(date +%F)-<name> -verify
   ```
   A non-zero exit means tasks remain. That is not a block if the user already accepted it
   in step 3 — but it must be stated in the summary, not silently passed over.

7. **Commit** — per the Archive checkpoint in `POLICY.md`:
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
**Decisions:** <the records this change wrote or amended, or: none owed>

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
- Run `{invariants}`. If the change added or altered a universal invariant and
  `{invariants-index}` has no row for it, say so and confirm before archiving: the index is
  the only place that answers "what enforces this claim" once the change is archived.
- **Ask the ADR question once more, because this is the last point the change's context is in
  hand.** Read the change's `design.md` Decisions and its `review.md` findings against
  `POLICY.md`'s three tests: a decision that constrains a change nobody has proposed yet, one
  evidenced by an absence, one narrowing an accepted record. If a record is owed and none was
  written — or an accepted record the change contradicted is still unmarked — say so and use the
  **question** tool before archiving. This informs and confirms; it does not block. Once the
  directory moves, the reasoning survives only in `changes/archive/`, which nobody reads while
  deciding the next change, and reconstructing it later produces a guess with a date on it.
- Stage explicit paths, and do not sweep unrelated work into the archive commit — another
  session may have staged files.
