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
> command or path. **If PROJECT.md is missing, or names paths this project does not have, run POLICY.md's
> "Bootstrap" first.** A slot left empty or `none` is **skipped, and you say it was skipped** — an
> unrun check and a passing one must never read alike.

Archiving is only bookkeeping: it moves a directory and commits. Nothing is merged anywhere —
the change's own artifacts, and the code and tests they produced, are the record. `changes/archive/`
is created by the first archive.

**Input**: optionally a change name. If omitted, infer it from the conversation; if that is
ambiguous you MUST ask rather than guess.

## Steps

1. **Select the change.** If a name was given, use it. Otherwise
   `bun .opencode/workflow/changestat.ts` lists the active ones with their task progress; if more
   than one is active and the intent is unclear, use the **question** tool. Never auto-select.

   **Collect every confirmation this skill asks for — steps 2 and 3 and the two guardrails on
   invariants and records — and ask them as one question set before step 5**, not one at a time.
   When none of them fires, ask nothing.

2. **Check the artifacts are present.** `changes/<name>/` should hold `proposal.md`,
   `design.md` and `tasks.md`. A missing artifact is a warning, not a block: report it and
   use the **question** tool to confirm before proceeding.

3. **Check task completion.**
   ```bash
   bun .opencode/workflow/changestat.ts -change <name>
   ```
   Report the count. Incomplete tasks are a warning, not a block — confirm with the user
   before proceeding.

   **Clear the todo list as the last act of the archive.** The move takes `tasks.md` out of
   `changes/<name>/`, so every todo now mirrors a file that is no longer there; an empty list is the
   correct state for a finished change.

   A ticked box is a claim that the work was done, not evidence of it. The review gate below is
   what judges the work.

4. **Hard review gate — a code change MUST be reviewed before archiving.**

   Check whether `changes/<name>/review.md` exists; its presence proves `/wf-review` ran.

   - **Present:** the gate is satisfied — proceed.
   - **Absent:** determine whether the change produced implementation code, by reading
     `tasks.md` and looking at what was written.
     - **Docs or tooling only** (no code): the gate does not apply. Note the exception and
       proceed.
     - **Any code change, or you cannot confidently establish it was docs-only:** do not
       archive. Hand off to review (below); the flow runs it and comes back here.

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

7. **Update the moved `report.md`** per `POLICY.md`'s "The report": every stage done in "Where
   it stands", `State: done`, "Waiting on you" empty, the summary below as "Latest stage", and a
   final log row. This is the report a reader of the finished change reads.

8. **Commit** — per the Archive checkpoint in `POLICY.md`:
   ```bash
   git add "changes/archive/$(date +%F)-<name>/report.md"
   git commit -m "chore(changes): archive <name>"
   ```
   The `git mv` is already staged. Stage explicit paths; never `git add -A`.

## Stage summary — the "Latest stage" block in `report.md`

```
## Archive Complete

**Change:** <name>
**Archived to:** changes/archive/YYYY-MM-DD-<name>/
**Tasks:** <done>/<total>
**Review:** review.md present (or: exempt — docs/tooling only)
**Decisions:** <the records this change wrote or amended, or: none owed>

<any warnings the user accepted>
```

When the review gate blocks, nothing moves and nothing is committed; the hand-off routes to
review.

## Guardrails

- Never auto-select a change the user did not name.
- Incomplete artifacts and tasks **inform and confirm**; they do not block.
- **The review gate is a hard block on archiving**, not on the flow. Never archive a change
  containing code without `review.md`; route it to review instead. Fail closed when unsure.
- Use `git mv` so the change's history follows it.
- Run `{invariants}`, or say it is not declared. If the change added or altered a universal
  invariant and `{invariants-index}` has no row for it, say so and confirm before archiving: the
  index is the only place that answers "what enforces this claim" once the change is archived.
- **Ask the ADR question once more, because this is the last point the change's context is in
  hand.** Read the change's `design.md` Decisions and its `review.md` findings against
  `POLICY.md`'s three tests: a decision that constrains a change nobody has proposed yet, one
  evidenced by an absence, one narrowing an accepted record. If a record is owed and none was
  written — or an accepted record the change contradicted is still unmarked — say so and use the
  **question** tool before archiving. This informs and confirms; it does not block. Once the
  directory moves, the reasoning survives only in `changes/archive/`, which nobody reads while
  deciding the next change.
- Stage explicit paths, and do not sweep unrelated work into the archive commit — another
  session may have staged files.

## Hand-off

Then return the hand-off from `POLICY.md`'s "The hand-off":

- Archived and committed → `next: done`, `stop: done`.
- The review gate blocked → `next: review`, `next-scope: whole`, `stop: none`, `commit: none`.
- A confirmation from step 1 is outstanding → `stop: needs-input`, before step 5.

As a `wf-flow` stage, every instruction above to ask the user becomes a `stop: needs-input`
hand-off carrying that question and your recommended answer; you are resumed with the answer and
continue from where you stopped. Loaded directly, outside `wf-flow`, load `wf-flow` and continue
from `next` instead of ending your turn — unless `stop` is not `none`.
