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

This is an **agent-driven** operation. You critique the plan yourself (with full conversation
context) and **rewrite the change's artifacts to correct what you found**. This step runs
**pre-implementation only** and NEVER edits code.

**Correcting the proposal here is the point of the step.** Nothing is built yet, so a task added or
a design reworked costs only the edit. A review that finds a gap and leaves it in place has not
saved work — it has moved the gap into apply, which is the one place it is expensive. See "The
proposal is corrected before apply, not after".

**Input**: Optionally specify a change name (e.g., `/wf-review-proposal add-auth`). If omitted,
check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for
available changes.

**Guardrails**

- Favor straightforward, minimal implementations first; add complexity only when requested or clearly required.
- Keep the proposal tightly scoped to the requested outcome.
- Read the project's own standards and its relevant decision records before proceeding.
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
* Decision capture — does the plan record the decisions it makes, and mark the accepted records it
  contradicts? This is the one obligation nobody downstream can discharge cheaply: `/wf-review` is
  forbidden from authoring a record, and by then the reasoning is a week old. Judge it on the three
  tests, and treat an unanswered question as a finding — the proposal is required to state that its
  decisions are local when they are.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise infer from conversation context, auto-select if only one
   active change exists, or run `changestat` and use the **question** tool to let the user select.
   Announce: "Reviewing proposal: <name>".

2. **Pre-flight — establish what is still unbuilt**

   ```bash
   changestat CHANGE=<name>
   ```
   Read every artifact in `changes/<name>/`. Note
   which groups are `- [x]`.

   - **If the tasks you would revise are complete, ABORT.** A plan for shipped code is a record,
     not a plan; rewriting it hides what was built. Suggest `/wf-update` for a scoped artifact
     revision, or `/wf-review` for a code review.
   - **If a review escalated a `design` finding on an *unbuilt* task group**, review only that
     group. Announce the restriction: "Reviewing proposal: <name> (task group N only)". Touch no
     artifact describing shipped work. This is the one path by which this step legitimately runs
     on a change that is mid-flight, and it exists because `/wf-review` is required to escalate
     design findings here rather than author them itself.
   - **If nothing is built, review the whole proposal** as normal.

   A blanket "abort if any task is `- [x]`" was the earlier rule. It was overridden the first
   time it collided with the escalation path above, which is worse than the rule not existing:
   the reviewer improvised the scope instead of reading it.

3. **Read for context**

   - Read `changes/<name>/proposal.md`, `design.md` and `tasks.md`.
   - Read the project's own standards and its relevant decision records.
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
     front of whoever owns the schedule via a fresh `/wf-propose`.
   - **Net task count is not the test.** An earlier rule made `Refine` unavailable whenever the
     revisions added more tasks than they removed, which forced a review that found one missing
     task to discard the whole reviewed plan. Count is not scope; the objective is.
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
   - every task is a `- [ ] N.X` checkbox, so `changestat` counts it, and is grouped under a
     `## N.` heading that maps to one commit;
   - `changestat CHANGE=<name>` reports the task count you expect;
   - no artifact cites `file:line` — durable artifacts cite symbols;
   - the ADR question is answered either way: a task writing the record and its index row, a task
     marking each record this change contradicts, or a stated position that the decisions are
     local to this change.

9. **Commit** — per the Review Proposal checkpoint:

   ```bash
   git add "changes/<name>/"
   git commit -m "docs(changes): review-proposal <name>"
   ```
   If the verdict is **Sound** (no edits needed), skip the commit and say so.

**Verdict Scale**

- **Sound** — solves the problem; design & tasks complete; ready for `/wf-implement`. No edits.
- **Refine** — fundamentally right; the revisions correct it toward the stated objective. Applied
  here, then re-validated. This is the expected verdict whenever anything was found.
- **Rework** — wrong problem or approach, **or** closing a finding would change the change's
  objective rather than complete it. Recommend a fresh `/wf-propose`.

**Output On Success**

```
## Proposal Review Complete: <change-name>

**Verdict:** <verdict>
**Scope reviewed:** <whole proposal | task group N only>
**Findings:** <n> (problem-fit, assumptions, tasks, grounding)
**Tasks:** +<added> / -<removed>
**Revisions:** <artifacts revised, or "none">
**Artifacts:** coherent; tasks countable by changestat ✓

<recommendation, e.g. "Ready for /wf-implement." or "Recommend /wf-propose restart.">
```

**Guardrails (execution)**

- **Scope is set in step 2, not improvised.** Either nothing is built, or a review escalated a
  design finding on a named unbuilt group. There is no third case.
- **Fixing the artifacts is the deliverable, not a side effect.** Edit `proposal.md`, `design.md`,
  and `tasks.md` directly; leave them coherent with each other.
- **Ask only on ambiguity or objective.** Not on every edit, and not before adding a task that
  the stated objective requires.
- **A revision that pursues a new objective is `Rework`**, however few tasks it adds.
- NEVER edit code.
- Reuse existing behaviour and code patterns; do not invent parallels.
- **Do not write a scenario for behaviour that does not exist** unless a task in the same plan
  builds it. That asymmetry — a requirement written as an aspiration — is what turned one review
  finding into nine tasks of unproposed production work.
