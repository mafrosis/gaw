---
name: wf-update-change
description: Update a change by revising its existing planning artifacts and keeping them coherent with one another. Use when the user wants to revise a change's plan, fold new decisions into it, or reconcile its artifacts after an edit. Never edits code.
license: MIT
metadata:
  author: mafrosis
  derived-from: "OpenSpec, https://github.com/Fission-AI/OpenSpec"
  version: "1.0"
---

Revise a change's existing planning artifacts and keep them coherent. Never edit code.

**Input**: optionally a change name. If omitted, infer it from the conversation; if that is
ambiguous you MUST ask rather than guess.

## Steps

1. **Select the change.** `changestat` lists the active ones with task progress. Present the
   plausible candidates with the **question** tool, marking the most recently modified
   "(Recommended)". Never auto-select.

2. **Read what exists.** A change holds `proposal.md`, `design.md` and `tasks.md`, and
   possibly `review.md` and `test_plan.md`. Revise only files that already exist; if an
   artifact is missing, say so and point at `/wf-propose` rather than creating it here.

   **A revision to `tasks.md` obliges a re-seed of the todo list**, from the file and in file order,
   before this step reports. `tasks.md` is authoritative and the list mirrors it, so renumbering,
   splitting or dropping a task leaves any list held by this session or the one that resumes after it
   describing tasks that no longer exist. Re-seed from the file; never edit the file to match a list.

3. **Understand the request.**
   - A specific revision ("the design now uses X") is the starting edit.
   - A bare "update" or "make this coherent" is a coherence review: read the artifacts
     against each other for contradictions, gaps and duplication.

4. **Reconcile in any direction.** Apply the requested edit, then check every other artifact
   against it. An edit to `tasks.md` can require revising `design.md`, not only the reverse —
   authoring order is a useful reading order, not a constraint on what may be revised. If the
   change is already coherent, say so and write nothing.

5. **Confirm and apply, one artifact at a time.** Show each proposed revision and why; write
   only after the user confirms. If they reject one, leave that artifact untouched.

   **Exception:** when `wf-review-proposal` delegates a reconciliation, it has already
   agreed the revisions and owns the review — apply them and report rather than re-confirming
   each.

6. **Commit** — per the Update checkpoint:
   ```bash
   git add <the revised artifact files>
   git commit -m "docs(changes): update <name>"
   ```
   **Skip the commit** when no edits were made, or when this skill was invoked as a delegated
   sub-step of a workflow step that owns the commit — leave the revisions staged for the caller.

7. **Point at the next step, without acting on it.**
   - Revising a design because `/wf-review` escalated a `design` finding → `/wf-review-proposal`
     on the affected unbuilt task group, then `/wf-implement`. This step is half of that
     escalation; reviewing the revised design is the other half, and skipping it puts
     unreviewed design into the tree.
   - Change already implemented → the code may no longer match the revised plan; `/wf-implement`
     carries the delta into code.
   - Everything done → `/wf-archive`.

## Guardrails

- **Planning artifacts only — never edit implementation code.** If the revised plan implies a
  code change, stop and point at `/wf-implement`.
- Revise only files that exist; creating artifacts is `/wf-propose`'s job.
- Confirm every edit before writing, except when delegated per step 5.
- Durable artifacts cite **symbols**, never `file:line`.
- If the request changes the change's *intent* rather than refining it, recommend a fresh
  change instead.
