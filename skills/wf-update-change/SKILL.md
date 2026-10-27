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

> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.** POLICY.md
> holds the workflow's rules; PROJECT.md resolves every `{slot}` below into this project's actual
> command or path. **If PROJECT.md is missing, or names paths this project does not have, run POLICY.md's
> "Bootstrap" first.** A slot left empty or `none` is **skipped, and you say it was skipped** — an
> unrun check and a passing one must never read alike.

**Input**: optionally a change name. If omitted, infer it from the conversation; if that is
ambiguous you MUST ask rather than guess.

## Steps

1. **Select the change.** If a name was given, use it. Otherwise
   `bun .opencode/workflow/changestat.ts` lists the active ones with task progress; present the
   plausible candidates with the **question** tool, marking the most recently modified
   "(Recommended)". Never auto-select.

2. **Read what exists.** A change holds `proposal.md`, `design.md`, `tasks.md` and `report.md`,
   and possibly `review.md` and `test_plan.md`. Revise only files that already exist; if an
   artifact is missing, say so and point at `/wf-propose` rather than creating it here.

   **A revision to `tasks.md` obliges a re-seed of the todo list — but only once the change has
   started**, which means at least one task in `tasks.md` is ticked. When one is, re-seed from the
   file and in file order, before this step reports: `tasks.md` is authoritative and the list mirrors
   it, so renumbering, splitting or dropping a task leaves the list describing tasks that no longer
   exist. Re-seed from the file; never edit the file to match a list.

   **When nothing is ticked, seed nothing.** There is no progress to mirror, and `/wf-implement`
   seeds the list itself before it writes any code. A list you *find* populated on an unstarted
   change belongs to an earlier session; say so and leave it, and never extend it with tasks from
   this one.

3. **Understand the request.**
   - A specific revision ("the design now uses X") is the starting edit.
   - A bare "update" or "make this coherent" is a coherence review: read the artifacts
     against each other for contradictions, gaps and duplication.

4. **Reconcile in any direction.** Apply the requested edit, then check every other artifact
   against it. An edit to `tasks.md` can require revising `design.md`, not only the reverse —
   authoring order is a useful reading order, not a constraint on what may be revised. If the
   change is already coherent, say so and write nothing.

5. **Apply, and confirm only what was not asked for.** An edit that carries out the revision the
   user requested, or that restores coherence with it, is applied without asking — the request
   was the confirmation. Ask, one question for the lot, only before an edit the request did not
   imply: one that changes scope, drops a task, or alters a decision. If the user rejects one,
   leave that artifact untouched.

   When `wf-review-proposal` delegates a reconciliation, it has already agreed the revisions and
   owns the review — apply them all without asking.

6. **Update `report.md`** per `POLICY.md`'s "The report" — each decision revised or reversed in
   "Decisions and trade-offs", and what changed as "Latest stage" — unless delegated, when the
   caller updates it.

   **Commit** — per the Update checkpoint in `POLICY.md`:
   ```bash
   git add <the revised artifact files> "changes/<name>/report.md"
   git commit -m "docs(changes): update <name>"
   ```
   **Skip the commit** when no edits were made, or when this skill was invoked as a delegated
   sub-step of a workflow step that owns the commit — leave the revisions staged for the caller.

7. **Name the next stage; do not run it here.** The choice is the hand-off below.

## Guardrails

- **Planning artifacts only — never edit implementation code.** If the revised plan implies a
  code change, stop and point at `/wf-implement`.
- Revise only files that exist; creating artifacts is `/wf-propose`'s job.
- Confirm only edits the request did not imply, per step 5.
- Durable artifacts cite **symbols**, never `file:line` (`POLICY.md`).
- If the request changes the change's *intent* rather than refining it, recommend a fresh
  change instead.

## Hand-off

When delegated by `wf-review-proposal`, return to it and hand off nothing. Otherwise return the
hand-off from `POLICY.md`'s "The hand-off":

- A design revised because a review escalated a `design` finding → `next: review-proposal`,
  `next-scope: task group N`, `stop: none`. Skipping that review puts unreviewed design into the
  tree.
- Planning revised on a change with unbuilt or changed tasks → `next: review-proposal`,
  `next-scope: whole`, `stop: none`, unless only wording changed, then the stage `report.md`
  named as next before this one.
- Everything already implemented and unchanged in substance → `next: archive`, `stop: none`.
- A question from step 5 → `stop: needs-input`.

As a `wf-flow` stage, every instruction above to ask the user becomes a `stop: needs-input`
hand-off carrying that question and your recommended answer; you are resumed with the answer and
continue from where you stopped. Loaded directly, outside `wf-flow`, load `wf-flow` and continue
from `next` instead of ending your turn — unless `stop` is not `none`.
