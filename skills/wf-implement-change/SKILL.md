---
name: wf-implement-change
description: Implement tasks from a change. Use when the user wants to start implementing, continue implementation, or work through tasks.
license: MIT
metadata:
  author: mafrosis
  derived-from: "OpenSpec, https://github.com/Fission-AI/OpenSpec"
  version: "1.0"
---

Implement tasks from a change.

> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.** POLICY.md
> holds the workflow's rules; PROJECT.md resolves every `{slot}` below into this project's actual
> command or path. **If PROJECT.md is missing, or names paths this project does not have, run POLICY.md's
> "Bootstrap" first.** A slot left empty or `none` is **skipped, and you say it was skipped** — an
> unrun check and a passing one must never read alike.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `bun .opencode/workflow/changestat.ts` to list the active ones and use the **question** tool to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/wf-implement <other>`).

2. **Read the change and its progress**

   The change lives in `changes/<name>/` and holds `proposal.md`, `design.md` and `tasks.md`,
   plus `review.md` once it has been reviewed. Read all of them, and `.opencode/workflow/POLICY.md`.

   ```bash
   bun .opencode/workflow/changestat.ts -change <name>
   ```

   - **No `tasks.md`:** the change is not ready to apply — hand off to propose.
   - **All tasks ticked:** say so and hand off to review (or archive, if the latest review has
     already approved it).
   - **Otherwise:** announce the progress and the remaining task groups, then proceed to
     implementation starting at the first unticked task.

3. **Seed the session todo list from `tasks.md`**

   Before touching any code, call the **todowrite** tool once with **one todo per unticked task**
   in `tasks.md`, in file order, each labelled `<group>.<n> <task text>`. Do this every session,
   including a resumed one — the harness starts with an empty list, so a resumed session that
   skips this step runs with no visible plan at all.

   The label matters mechanically: `.opencode/plugins/tasks-todo-sync.ts` joins a todo to its task
   on that leading identifier, and reports any disagreement with `tasks.md` until it is resolved. A
   todo without an identifier is invisible to it.

   `tasks.md` is the durable record; the todo list is a session mirror of it. Where they
   disagree, `tasks.md` wins and the todo list is re-seeded from it. Never invent a todo that has
   no task behind it.

   Add `RN.X` review-fix tasks as todos on the same terms. If a task group is discovered to need
   splitting mid-session, re-seed from `tasks.md` after editing it, not the other way round.

4. **Implement tasks (loop until done or blocked)**

   For each pending task:
   - Mark its todo `in_progress` — exactly one at a time
   - Show which task is being worked on
   - Make the code changes required
   - Keep changes minimal and focused
   - Tick the box in `tasks.md`: `- [ ]` → `- [x]`, and mark its todo `completed`
   - Continue to next task

   **After each task group** (all tasks under a `## N` heading complete): auto-commit that
   group's code changes together with its `tasks.md` checkbox updates, per the git commit
   policy in `POLICY.md`:
   ```bash
   # stage this group's changed files + tasks.md, then:
   git commit -m "<type>(<scope>): <group summary> [<name>]"
   ```

   If this is the **last** group of the session, step 7's `test_plan.md` is staged into this same
   commit. Do step 7 first, so it is written before the commit rather than chased with a second one.

   **Reconcile the todo list against `tasks.md` as the first act of that commit**, before staging.
   The commit is the one step in the loop that cannot be skipped, so the mirror is checked there.
   `tasks-todo-sync` reports a disagreement in the result of the edit that caused it; if it has said
   nothing, there is nothing to reconcile.

   **Pause if** — and only if:
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → ask, recommending `/wf-update` +
     `/wf-review-proposal`
   - Error or blocker encountered that you cannot resolve within the task → report it
   - User interrupts

   Finishing a group is not a pause: commit it and start the next group.

   **Capture a decision this session made, before its evidence is gone.** Apply is where a
   decision is not just taken but *measured* — attempts made, what each returned — and that
   measurement exists nowhere else once the session ends. Leaving it unrecorded makes the next
   change repeat it.

   So when the work decides something that meets `POLICY.md`'s three tests — it constrains a
   change nobody has proposed yet, its evidence is an absence, or it narrows a record already
   accepted — and no task covers it:

   - **Append the task to the current group** rather than writing the record silently, so it is
     committed with the work that produced it and `bun .opencode/workflow/changestat.ts` counts it. One line, per the
     `tasks.md` rule: the record itself carries the reasoning.
   - The task writes the record, adds its row to `{decisions-index}`, and marks any accepted record
     the discovery contradicts — status, amendment block, index row, per `POLICY.md`'s "A decision
     the next change would re-litigate gets a record". If `{decisions-dir}` does not exist yet, the
     task creates it first (`POLICY.md`'s "Bootstrap"); if it is not declared, the decision goes in
     `design.md`.
   - **A record *this change* wrote, falsified by a later group of the same change, is not an
     amendment.** `POLICY.md`'s trigger is a sentence made false in an **accepted** record; one this
     change authored two groups ago was never accepted and shipped, so marking it amended dates a
     collision that never happened. It is an error in the change's own output: append a task to the
     current group and correct the record. The shape to watch for is a Consequence describing the
     mechanism as it stood mid-change — true when written, false one commit later once a following
     group moved the authority it named.
   - **But if the decision changes the change's direction** — it reverses an accepted record, or
     abandons the approach `design.md` was reviewed on — stop and escalate to `/wf-update` +
     `/wf-review-proposal`. Authoring a new direction here is unreviewed design entering the tree,
     for the reason step 5(d) gives, and the escalation is cheap while the code is still warm.

   **A deviation from the plan is recorded where the plan is.** When `design.md` or `tasks.md`
   prescribes something the code disproves — a premise that is false, a prescribed mutation that
   leaves the suite green — say so and write it under a `### Deviations from the plan` heading in
   `tasks.md`, with the evidence that disproved it. Step 5's `Deviations from review N's
   recommendations` is for a review's prescriptions only.

5. **Definition of done for a review fix (`RN.X` tasks)**

   A fix for a review finding is held to the standard the finding was raised under. Apply it to
   the fix's *own* output, not only to the code it corrects: a fix that ships a fresh instance of
   the fault it was closing has moved the fault, not closed it.

   Before committing a group containing `RN.X` tasks, confirm all four:

   a. **Every guard the fix added has a test that fails when the guard is removed.** Not
      "is covered" — removed or inverted, the suite run, seen red, restored. Record the mutation
      in a comment on the test, as `POLICY.md` requires — not in the `tasks.md` entry, which
      stays one line.
   b. **`{coverage}`, then `{coverage-gaps}` for each package or module the fix touched**, one
      invocation each. Assert it in the commit message: `Coverage-checked: <the units>`. Running
      `{coverage}` first is not optional — `{coverage-gaps}` reads a profile that nothing else
      regenerates, so a stale one satisfies the condition silently. A unit whose floor is above
      zero is reported with its residue, not declared clean. Where `PROJECT.md` declares neither
      command, say the check was unavailable rather than passing over it.
   c. **`{gate}` passes**, including every conditional gate `PROJECT.md` names for the surface
      touched, per `POLICY.md`.
   d. **The fix does only what the finding asked.** A fix that adds a mechanism, changes an
      interface, or refactors across module boundaries is not a review fix — it is new scope
      wearing one. Stop, and take it through `/wf-update` + `/wf-review-proposal`, which is
      the only path on which a design gets reviewed before it is written. Describe what the code
      does; a claim broader than the code becomes a mandate for work no proposal asked for.

   **If a fix cannot be implemented as written, do not approximate it.** Say so, record the
   deviation with its evidence in the `Deviations from review N's recommendations` section of
   `tasks.md`, and implement what the finding was actually protecting. A review's model of the
   code is sometimes wrong; implementing a prescription you have disproved is how a fix becomes
   a bug. If the fix requires a new mechanism or an interface change, stop and escalate to
   `/wf-update` + `/wf-review-proposal` rather than designing it here.

6. **On completion or pause, record status**

   In `report.md` and the hand-off:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If paused: **name which of step 4's four conditions fired**

   If none of the four fired, the session has not paused; it has stopped, and the next one pays the
   re-entry.

7. **Addendum — recommended test plan** (run when the apply session concludes: all tasks complete, or you're wrapping up a partial session)

   **Write this, and work out step 8's recommendation, before making the session's last task-group
   commit**, because the test plan and `report.md` are staged *with* that commit rather than after
   it. If the last group is already committed when you get here, stage them with the next group
   commit instead — do not make a commit that carries only these files.

   a. Summarize the work completed this session, including any task groups left incomplete (see step 6).

   b. Write a **Recommended Test Plan** — concrete steps and commands to verify
      the functionality works as intended: the `{test}` command, a narrower run of the packages or
      modules touched, manual steps, example requests. Prefer the project's real commands, as
      `PROJECT.md` declares them, over invented ones.

   c. Write `changes/<name>/test_plan.md`. If it already exists, **merge** with the existing content (do not clobber it) so it stays a comprehensive test plan for future readers.

   d. **Update `report.md`** per `POLICY.md`'s "The report": progress in "Where it stands", each
      decision and deviation this session made in "Decisions and trade-offs", the completion
      summary below as "Latest stage", and — if paused — the question in "Waiting on you".

   e. **Stage both with the group commit** — per the Apply checkpoint in `POLICY.md`:
      ```bash
      git add <this group's files> "changes/<name>/tasks.md" "changes/<name>/test_plan.md" "changes/<name>/report.md"
      git commit -m "<type>(<scope>): <group summary> [<name>]"
      ```
      The test plan and the report describe the work in that commit, so they belong in it.

      If apply paused mid-task awaiting clarification, update `report.md` only and leave it for
      the next group commit.

8. **Close the report with a recommendation on whether to review** — it sets the scope of the
   review stage the flow runs next

    The last thing the report says is whether `/wf-review` is worth a session. A round costs
    roughly what the apply session cost, so make the decision explicitly.

    **State the action, not a confidence about the action.** One of exactly three:

    - **Skip the round**, naming the cheaper check that replaces it. The review stage then runs only
      that check (`next-scope: targeted: <the check>`). Available **only** when all four conditions
      hold: no new mechanism, interface or module boundary was authored; every guard added is
      mutation-proven red with the mutation in a test comment; every **clause** of every behaviour
      the proposal promised is pinned by a named test; and the production diff is small enough that
      a reader can hold it in their head.
    - **Review, scoped to the surface you name** — the default when any one of the four is unmet
      (`next-scope: surface <what>`).
    - **Run `/wf-review`** — any new mechanism, any guard added without a failing test, or a
      production diff large enough that its own author cannot enumerate its edges.

    Justify it with **how many of the four conditions are unmet**, and which. That number is
    derived from facts about the session, so it cannot be talked up or down. Do not substitute a
    confidence band or a percentage: either still has to be translated into one of the three
    actions.

    Report the six signals in the output template below. Each is a fact about the session rather
    than a judgement, which is the point: the recommendation is defined by what the facts license,
    not by how the work felt.

    **The recommendation is about the round, never about the code.** Skipping is a claim that a
    *cheaper check covers the same surface* — never that the surface is clean. So: name the check,
    then run it. A skipped round is a substituted check, not an absent one.

    **Do not recommend skipping while any test written this session is verified only at
    whole-claim granularity** — count it as a condition unmet. A test's name is a claim, and each
    clause of that claim needs exercising. A test named for "X **and** Y" that demonstrates only X
    leaves Y unverified. A test existing per claim is not the check; a test exercising each clause
    is.

    **Weigh provenance.** If this session's work was `RN.X` review fixes, a following round
    would be reviewing review-derived work, which `POLICY.md`'s "Review-derived work and the
    provenance gate" permits to block only on a user-observable defect — so the round's conclusion is largely
    predetermined. Say so, and prefer the targeted check. If the session implemented the
    proposal's *What Changes*, a round has proposed work to review and that argument for
    skipping is weaker.

    **Never soften the recommendation because you authored the work.** The assessment is being
    made by whoever just wrote the code, which is the one perspective that cannot see its own
    blind spot, and the bias runs one way: toward skipping, because skipping is what ends the
    session. Where a signal is unmeasured, report it as unmeasured rather than as passing — an
    unrun `{coverage-gaps}` and a clean one are indistinguishable in a report that omits both.

**Output During Implementation**

```
## Implementing: <change-name>

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Stage summary on completion** — the "Latest stage" block in `report.md`

```
## Implementation Complete

**Change:** <change-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

### Recommended Test Plan
- <step / command 1>
- <step / command 2>

Test plan written to `test_plan.md`, staged with this session's last task-group commit.

### Review Recommendation

**<Skip the round — run <check> instead | Review, scoped to <surface> | Run `/wf-review`>**

Conditions unmet: <n> of 4<, and which>.

<one to three further lines only where the count does not speak for itself — provenance, or a
 signal below that is unmeasured rather than passing>

| Signal | This session |
|---|---|
| Production lines changed | <n, or "deletions only"> |
| New mechanism, interface or module boundary | <none / what> |
| Guards added, and mutation-proven red | <n of n> |
| Behaviours promised, and pinned by a named test | <n of n> |
| Provenance of this session's work | <proposal's What Changes / prior review's RN.X> |
| Artifact volume | <n lines across the change's artifacts> |

**What would change this:** <the specific finding that would move the recommendation>

All tasks complete. Next: review — <whole | scoped to <surface> | targeted: <check>>.
```

**Stage summary on pause** — the "Latest stage" block in `report.md`; the options also go in the
hand-off's `questions`

```
## Implementation Paused

**Change:** <change-name>
**Progress:** 4/7 tasks complete
**Condition:** <which of step 4's four fired>

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1, recommended>
2. <option 2>
```

**Guardrails**
- **Seed the todo list from `tasks.md` before writing any code** (step 3), every session,
  including a resumed one. The harness has no view into `tasks.md`, so a session that skips this
  runs with the user unable to see the plan or the progress.
- **`tasks.md` is authoritative; the todo list mirrors it.** One todo per unticked task, labelled
  with the task's identifier, exactly one `in_progress`. Reconcile the mirror at the group commit
  (step 4), which is the only step in the loop that cannot be skipped.
- **Keep going through tasks until done or blocked**, where blocked means one of step 4's four
  conditions. Session length is not one of them, and neither is the pull of step 7: a report is the
  shape of finished work, so reaching for it is attractive at any group boundary. **A limit you
  cannot measure is not a limit you have** — there is no context meter here, so "running low" is an
  impression, not a constraint.
- Always read the change's artifacts before starting
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Auto-commit once per task group (bundling code with its checkbox updates) per the git commit policy in `POLICY.md`
- **A group containing `RN.X` review fixes is not committable until step 5's four conditions
  hold.** A fix that adds an unverified guard has moved the fault rather than closed it, and
  nothing mechanical will notice.
- **A fix does only what its finding asked** (step 5d). If you are adding a mechanism
  inside a review fix, stop and escalate via `/wf-update` + `/wf-review-proposal`.
- **Never design in a review fix.** If an `RN.X` task calls for a new mechanism or an interface
  change, stop and escalate to `/wf-update` + `/wf-review-proposal`.
- **Record every deviation with its evidence** — a review's prescription under
  `Deviations from review N's recommendations`, the plan's under `### Deviations from the plan`
  (step 4). A silently-approximated fix reads as done at the next review, and a silently-corrected
  plan makes the next change repeat the work that disproved it.
- **A decision this session measured gets its record, as an appended task in the group that
  produced it** (step 4). The measurement behind a rejected alternative exists only during apply;
  leaving it uncaptured makes the next change repeat it. A decision that changes *direction*
  escalates instead.
- Pause on errors, blockers, or unclear requirements - don't guess
- On wrap-up, write/merge `changes/<name>/test_plan.md` and update `report.md`, both **staged
  with the session's last task-group commit** and never as a commit of their own, per the Apply
  checkpoint in `POLICY.md`. Write them before making that commit.
- **Close the report with a review recommendation** (step 8): one of the three actions, how many
  of the four conditions are unmet, the six signals, and what would move it. Skipping names the
  cheaper check *in the recommendation itself* — a recommendation to skip with no named substitute
  is a recommendation to stop checking.
- **A claim is not pinned until a test exercises every clause of it.** Until it is done per
  clause, that is a condition unmet, so skipping is not available.

## Hand-off

Then return the hand-off from `POLICY.md`'s "The hand-off":

- Every task ticked → `next: review`, `next-scope` from step 8's recommendation, `stop: none`.
- Paused on an unclear task or a design issue → `stop: needs-input`, with the options from the
  pause summary. You are resumed with the answer and carry on at the task that paused.
- Paused on a blocker you could not resolve → `stop: blocked`.

As a `wf-flow` stage, every instruction above to ask the user becomes a `stop: needs-input`
hand-off carrying that question and your recommended answer; you are resumed with the answer and
continue from where you stopped. Loaded directly, outside `wf-flow`, load `wf-flow` and continue
from `next` instead of ending your turn — unless `stop` is not `none`.
