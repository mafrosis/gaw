---
name: wf-flow
description: Run the change workflow from a given stage, carrying on from stage to stage until a human decision is needed. Use when the user runs a /wf-* command, wants to continue a change, or wants a change taken as far as it can go.
license: MIT
metadata:
  author: mafrosis
  version: "1.0"
---

Run the change workflow from a stage, and keep going until a human is needed.

> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.** POLICY.md
> holds the workflow's rules; PROJECT.md resolves every `{slot}` below into this project's actual
> command or path. **If PROJECT.md is missing, or names paths this project does not have, run POLICY.md's
> "Bootstrap" first.** A slot left empty or `none` is **skipped, and you say it was skipped** — an
> unrun check and a passing one must never read alike.

You are the **orchestrator**. You do not do any stage's work yourself: each stage runs in its own
subagent, and you read only what it hands back and the change's `report.md`. Keeping code out of
this context is the point — it is what lets a long run stay coherent.

The flow, its stop conditions and the transitions are in `POLICY.md`'s "The pipeline". Read the
diagram and both tables there before starting; this skill is the procedure that applies them.

**Input**: a starting stage (`propose`, `review-proposal`, `implement`, `review`, `archive`,
`update`, or `continue`), and the user's argument — a change name, a description, or a revision
request. Optionally a **bound**: "only", "stop after <stage>", "up to <stage>".

## Steps

1. **Bootstrap, here.** If `PROJECT.md` needs bootstrapping, do it now, in this session: it asks
   the user questions, and a stage subagent cannot.

2. **Resolve the change and the starting stage.**
   - `propose` with a description: the stage derives the name; pass the description through.
   - Any other stage: resolve the change name from the argument or the conversation. If more than
     one active change fits, list them with `bun .opencode/workflow/changestat.ts` and ask with the
     **question** tool. Never guess.
   - `continue`: read `changes/<name>/report.md` and start at its **Next**. With no `report.md`,
     ask which stage to start at, recommending one from the change's artifacts and task progress.
   - Record the bound, if the user gave one.

3. **Show the run.** Call **todowrite** with one todo per stage this run expects to reach, from the
   starting stage to `archive` or the bound — `wf: review-proposal`, `wf: implement`, and so on.
   Never label one with a task identifier: the task-level list belongs to the implement stage's own
   session, and a label like `2.1` here would be compared against `tasks.md`.

4. **Run the stage.** Mark its todo `in_progress` and launch it with the Task tool,
   `subagent_type: "wf-stage"`. The prompt carries:
   - the skill to load: `wf-propose-change`, `wf-review-proposal`, `wf-implement-change`,
     `wf-review-change`, `wf-archive-change` or `wf-update-change`;
   - the change name, or for `propose` the user's description;
   - `next-scope` from the previous hand-off, when there is one — a task group for
     review-proposal, the review's scope for review;
   - the user's own words for this run, verbatim, and any answers already given;
   - that it runs as a `wf-flow` stage and returns a `WF-HANDOFF` block.

   If `wf-stage` is not available, use `general` — except for `implement`, which needs `todowrite`:
   load `wf-implement-change` and run it in this session instead, then continue from its hand-off.
   Its task list replaces the stage todos while it runs; re-create the remaining stage todos when
   it hands off.

5. **Read the hand-off.** Take only the `WF-HANDOFF` block from the subagent's reply; ignore the
   rest. Mark the stage's todo `completed`, and print one line: the stage, its outcome and its
   commit.

   If the reply has no hand-off block, read `report.md` to establish what happened, and treat the
   stage as **blocked** unless the report shows it completed.

6. **Decide, by the tables in `POLICY.md`.** In this order:
   - `stop: needs-input` — ask the questions with the **question** tool, one question each, the
     stage's recommendation first. Then **resume the same subagent** — the Task tool with the
     `task_id` it returned — passing the answers, and go back to step 5.
   - `stop: parked`, `blocked` or `done` — stop.
   - **Loop guard** — the stage was review round 3 or later and its verdict is `Changes required`:
     stop.
   - **Bound** — the stage just run is the one the user said to stop after: stop.
   - Otherwise take `next` and `next-scope`, add a todo if `next` is a stage the list does not have
     (a second review round, an implement pass for `RN.X` tasks), and go to step 4.

   Do not stop for any other reason. A finished stage, a clean commit and a long run are not stop
   conditions; stopping on one hands the user a question that has only one answer.

7. **When the run stops, report once.** Print the change's `report.md` as it now stands, then one
   line naming the stop and what the user can do: answer, `/wf-continue <name>`, or nothing. That
   report is cumulative — a reader who sees only this message knows every decision and trade-off
   the run made. Do not add a separate summary of your own.

## Guardrails

- **Never do a stage's work in this context**, beyond the one fallback in step 4. Read
  `report.md` and hand-offs; do not read code, diffs or the other artifacts.
- **Ask only what a stage returned as `needs-input`**, plus step 2's change selection. Everything
  else either continues or is one of `POLICY.md`'s stops.
- **Resume, do not restart.** An answered question goes back to the subagent that asked it, so the
  stage keeps the reading it had.
- **One stage at a time.** Stages share a branch and commit as they go; never run two in parallel.
- **`/wf-explore` is not a stage.** If the user wants to explore, load `wf-explore` in this
  session; when it ends in "start a proposal", come back here at `propose`.
- Never push, and never open a pull request.
