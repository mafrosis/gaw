---
name: wf-review-proposal
description: Critically review a change's proposal before implementation (problem-fit, assumptions, task completeness), then correct the proposal artifacts directly. Use after propose and before apply.
license: MIT
metadata:
  author: mafrosis
  derived-from: "OpenSpec, https://github.com/Fission-AI/OpenSpec"
  version: "1.0"
---

Provide a critical review of a change proposal BEFORE implementation, then refine it.

> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.** POLICY.md
> holds the workflow's rules; PROJECT.md resolves every `{slot}` below into this project's actual
> command or path. **If PROJECT.md is missing, or names paths this project does not have, run POLICY.md's
> "Bootstrap" first.** A slot left empty or `none` is **skipped, and you say it was skipped** — an
> unrun check and a passing one must never read alike.

This is an **agent-driven** operation. You critique the plan yourself (with full conversation
context) and **rewrite the change's artifacts to correct what you found**. This step runs
**pre-implementation only** and NEVER edits code.

**Correcting the proposal here is the point of the step.** Nothing is built yet, so a task
added or a design reworked costs only the edit. A review that finds a gap and leaves it in place
has moved the gap into apply, where it is expensive. See "The proposal is corrected before apply,
not after" in `.opencode/workflow/POLICY.md`.

**Input**: Optionally specify a change name (e.g., `/wf-review-proposal add-auth`). If omitted,
check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for
available changes.

**Guardrails**

- Favor straightforward, minimal implementations first; add complexity only when requested or clearly required.
- Keep the proposal tightly scoped to the requested outcome.
- Read `.opencode/workflow/POLICY.md` and `PROJECT.md`, then the records in `{decisions-dir}` its
  *"Which records a design must account for"* makes relevant — every one naming a symbol the design
  names. A record the design does not account for is a finding.
- Identify vague or ambiguous details and ask follow-up questions BEFORE any files change.
- Review the codebase and ALWAYS prefer reusing existing patterns.
- If the request changes the change's *intent* (not just refining it), recommend a fresh `/wf-propose` instead of patching.

**Focus Areas**

* Problem-fit — does the proposal, as written, actually solve the stated objective?
* Assumptions & edge cases — any false assumptions or missing edge cases?
* Task completeness — will the tasks list, if executed, meet the objective?
* Verifiability — does each task state something you can tell is done, and does behaviour the
  change adds get a test that would fail without it?
* Codebase grounding — does it reuse existing patterns and fit current architecture?
* Decision capture — does the plan record the decisions it makes, and mark the accepted records
  it contradicts? Nobody downstream can discharge this cheaply: `/wf-review` may not author a
  record. Judge it on `POLICY.md`'s three tests, and treat an unanswered question as a finding —
  the proposal is required to state that its decisions are local when they are.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise infer from conversation context, auto-select if only
   one active change exists, or run `bun .opencode/workflow/changestat.ts` and use the **question** tool to let the user
   select. Announce: "Reviewing proposal: <name>".

2. **Pre-flight — establish what is still unbuilt**

   **Clear the todo list first.** A list you find populated at this point belongs to an earlier
   session, and the plan about to be reviewed is one nobody has started. Call **todowrite** with an
   empty list, or re-seed it from *this* change's `tasks.md` once step 3 has read it, so a review of
   one change never reports progress against another.

   ```bash
   bun .opencode/workflow/changestat.ts -change <name>
   ```
   Read every artifact in `changes/<name>/`. Note
   which groups are `- [x]`.

   - **If the tasks you would revise are complete, ABORT.** A plan for shipped code is a record,
     not a plan; rewriting it hides what was built. Suggest `/wf-update` for a scoped artifact
     revision, or `/wf-review` for a code review.
   - **If a review escalated a `design` finding on an *unbuilt* task group**, review only that
     group. Announce the restriction: "Reviewing proposal: <name> (task group N only)". Touch no
     artifact describing shipped work. This is the one path by which this step runs on a change
     that is mid-flight, because `/wf-review` escalates design findings here rather than authoring
     them.
   - **If nothing is built, review the whole proposal** as normal.

3. **Read for context**

   - Read `changes/<name>/proposal.md`, `design.md` and `tasks.md`.
   - Read `.opencode/workflow/POLICY.md` and `PROJECT.md`, then the records in `{decisions-dir}`
     its *"Which records a design must account for"* makes relevant. Resolve them from the design's
     own symbols rather than from titles — a record's title often names none of what it
     constrains.
   - Search the tests before proposing new behaviour: a claim the suite already pins does not
     need restating, and one it contradicts is the finding.
   - Explore the codebase (Grep/Glob/Read) so the plan aligns with implementation reality.

4. **Critique the plan**

   Assess and record findings across the Focus Areas above, each with concrete references
   (`file:line`, requirement name, or task id). Assign a verdict (see scale below).

5. **Ask clarifying questions**

   Use the **question** tool for a finding that is genuinely ambiguous, or where closing it
   would change the change's **objective** rather than complete it. Resolve those before editing.
   Everything else you simply fix in step 7 and report.

6. **Judge the revision against the objective, not against a task count**

   A critique of a plan produces tasks, and tasks are committed work — but at this point they are
   the cheapest work in the pipeline.

   - **Test each revision against the stated objective.** A task added because the objective
     cannot be met without it is this step working; add it. A task that pursues a **new**
     objective is scope creep: do not add it — return **`Rework`** and put the scope decision in
     front of whoever owns the schedule. Say which way each answer goes: adopting the new
     objective means a fresh `/wf-propose`, holding it means `/wf-update` drops that one task and
     the reviewed plan stands.
   - **A schedule answer is not a verdict.** If the plan is right and only its *timing* is in
     question — another change holds a file it needs, a decision is pending elsewhere — that is
     `Refine` with a `Precondition:`, not `Rework`. `Rework` says the plan is wrong, and returning
     it for a scheduling fact discards a plan whose findings this step has just verified.
   - **Net task count is not the test.** Count is not scope; the objective is.
   - **State each finding once, at the length its severity earns.** A finding whose fix changes
     executable behaviour gets its evidence and reproduction; documentation debt gets one line.
     Do not inventory what is correct and do not praise.
   - **Verify before you assert.** Measure a claim about runtime behaviour rather than reasoning
     from the code — a wrong measurement in a plan becomes a wrong task, and a task that cannot
     be done as written is how an apply session produces a vacuous test.

7. **Refine — rewrite the artifacts**

   - **EXISTING artifacts** (`proposal.md`, `design.md`, `tasks.md`): edit them **directly**.
     Then read every other artifact against each edit, in **any** direction — a revised task may
     require a revised design, not only the reverse — and correct what the edit made incoherent.
   - **A precondition that is not `none` is written into `proposal.md`** as a status line at the
     top: what must land first, and what clears it. The output block is a chat message; the
     artifact is what the next reader sees, and what `/wf-implement` reads before it starts.
   - **A missing whole artifact** (e.g. no `design.md` at all): write it if the change needs one,
     following `wf-propose-change`'s guidance for that artifact.
   - **A large multi-artifact reconciliation** may be delegated to the `wf-update-change`
     skill via the Skill tool. **Instruct it NOT to commit** — this step owns the single commit
     (step 9).
   - **Fundamentally flawed** (wrong problem/intent): recommend restarting with `/wf-propose`
     rather than patching.
   - **Never** touch any code.

8. **Check the artifacts are coherent and usable**

   Nothing validates these artifacts mechanically, so check by reading:
   - all three artifacts exist and none contradicts another;
   - every task is a `- [ ] N.X` checkbox, so `bun .opencode/workflow/changestat.ts` counts it, and is grouped under a
     `## N.` heading that maps to one commit;
   - `bun .opencode/workflow/changestat.ts -change <name>` reports the task count you expect;
   - no artifact cites `file:line` — durable artifacts cite symbols (`POLICY.md`);
   - the ADR question is answered either way: a task writing the record and its index row, a task
     marking each record this change contradicts, or a stated position that the decisions are
     local to this change.

9. **Commit** — per the Review Proposal checkpoint in `POLICY.md`:

   ```bash
   git add "changes/<name>/"
   git commit -m "docs(changes): review-proposal <name>"
   ```
   If the review made **no edits**, skip the commit and say so. The condition is the edits, not the
   verdict's name: a `Sound` plan that is parked still records its precondition in `proposal.md`,
   and that edit is committed like any other.

**Verdict Scale**

The verdict judges the **plan**. Whether the plan can *start* is a separate fact about the world,
carried by `Precondition:` in the output block — so "right, and waiting on another change" is
`Refine` with a precondition recorded, and never `Rework`.

- **Sound** — solves the problem; design & tasks complete; nothing to correct. Ready for
  `/wf-implement` when `Precondition: none`; otherwise the plan is right and waits, and recording
  the precondition is the only edit.
- **Refine** — fundamentally right; the revisions correct it toward the stated objective. Applied
  here, then re-validated. This is the expected verdict whenever anything was found, **including
  when the plan cannot start yet**: its findings are cheapest to close now, which is what this step
  is for.
- **Rework** — the plan itself is wrong, in one of two ways. Both put a decision in front of
  whoever owns the schedule; they differ in what each answer implies.
  - **The objective is wrong.** A fresh `/wf-propose` — there is nothing here worth keeping.
  - **Closing a finding would change the objective.** State the finding and the choice. Adopt the
    new objective and it is `/wf-propose`; hold the objective and it is `/wf-update`, dropping the
    task that pursued a different one and keeping the rest of the reviewed plan.

**Output On Success**

```
## Proposal Review Complete: <change-name>

**Verdict:** <verdict>
**Precondition:** <none | what must land first, and what clears it>
**Scope reviewed:** <whole proposal | task group N only>
**Findings:** <n> (problem-fit, assumptions, tasks, decisions, grounding)
**Tasks:** +<added> / -<removed>
**Revisions:** <artifacts revised, or "none">
**Artifacts:** coherent; tasks countable by `bun .opencode/workflow/changestat.ts` ✓

<recommendation, e.g. "Ready for /wf-implement.", "Parked on <change>; /wf-implement once it
 lands." or "Recommend /wf-propose restart.">
```

**Guardrails (execution)**

- **Scope is set in step 2, not improvised.** Either nothing is built, or a review escalated a
  design finding on a named unbuilt group. There is no third case.
- **Fixing the artifacts is the deliverable, not a side effect.** Edit `proposal.md`, `design.md`,
  and `tasks.md` directly; leave them coherent with each other.
- **Ask only on ambiguity or objective.** Not on every edit, and not before adding a task that
  the stated objective requires.
- **A precondition never defers a finding.** Parking a change is a scheduling act; leaving its plan
  uncorrected is the failure `POLICY.md`'s *"The proposal is corrected before apply, not after"*
  names. The findings are closed here, whatever the plan is waiting on — by the time the
  precondition clears, this reading of the code is stale.
- **A revision that pursues a new objective is `Rework`**, however few tasks it adds.
- NEVER edit code.
- Reuse the existing tests and code patterns; do not invent parallels.
- **Do not write a scenario for behaviour that does not exist** unless a task in the same plan
  builds it. A requirement written as an aspiration becomes a mandate for unproposed work.
