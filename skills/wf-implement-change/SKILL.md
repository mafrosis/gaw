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

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `changestat` to list the active ones and use the **question** tool to let the
     user select

   Always announce: "Using change: <name>" and how to override (e.g., `/wf-implement <other>`).

2. **Read the change and its progress**

   The change lives in `changes/<name>/` and holds `proposal.md`, `design.md` and `tasks.md`, plus
   `review.md` once it has been reviewed. Read all of them, and the project's own standards.

   ```bash
   changestat CHANGE=<name>
   ```

   - **No `tasks.md`:** the change is not ready to apply — point at `/wf-propose`.
   - **All tasks ticked:** say so and suggest `/wf-archive`.
   - **Otherwise:** announce the progress and the remaining task groups, then proceed to
     implementation starting at the first unticked task.

3. **Seed the session todo list from `tasks.md`**

   Before touching any code, call the **todowrite** tool once with **one todo per unticked task**
   in `tasks.md`, in file order, each labelled `<group>.<n> <task text>`. Do this every session,
   including a resumed one — the harness starts with an empty list, so a resumed session that
   skips this step runs with no visible plan at all.

   The label matters mechanically, not just for reading: `.opencode/plugins/tasks-todo-sync.ts`
   joins a todo to its task on that leading identifier, and a todo without one is invisible to it.

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

   **After each task group** (all tasks under a `## N` heading complete): auto-commit that group's
   code changes together with its `tasks.md` checkbox updates, per the project's commit policy:
   ```bash
   # stage this group's changed files + tasks.md, then:
   git commit -m "<type>(<scope>): <group summary> [<name>]"
   ```

   **Reconcile the todo list against `tasks.md` as the first act of that commit**, before staging.
   This is the anchor: the checkbox is bundled into a commit and so cannot be skipped without the
   commit being wrong, where the todo list has nothing holding it — nothing in this loop ever reads
   it back, and step 6 counts progress from `tasks.md`, so the report reads correct while the
   sidebar is stale. Reconciling here puts the mirror on the one step in the loop that cannot be
   skipped.

   `tasks-todo-sync` reports the disagreement in the result of the edit that caused it, so if it
   said nothing, there is nothing to reconcile.

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

   **Capture a decision this session made, before its evidence is gone.** Apply is where a decision
   is not just taken but *measured*, and the measurement exists nowhere else: a rejected alternative
   rests on the attempts made and what each returned — none of which anybody has after the session
   ends. A session that leaves that unrecorded has not deferred the work; it has destroyed the
   evidence, and the next change pays for those attempts again.

   So when the work decides something that meets the three tests — it constrains a change nobody has
   proposed yet, its evidence is an absence, or it narrows a record already accepted — and no task
   covers it:

   - **Append the task to the current group** rather than writing the record silently, so it is
     committed with the work that produced it and `changestat` counts it. One line, per the
     `tasks.md` rule: the record itself carries the reasoning.
   - The task writes the record, adds its row to the decision-record index, and marks any accepted
     record the discovery contradicts — status, amendment block, index row, per that index.
   - **But if the decision changes the change's direction** — it reverses a recorded ADR, or
     abandons the approach `design.md` was reviewed on — stop and escalate to `/wf-update` +
     `/wf-review-proposal`. Authoring a new direction here is unreviewed design entering the tree,
     for the reason step 5(d) gives, and the escalation is cheap while the code is still warm.

5. **Definition of done for a review fix (`RN.X` tasks)**

   A fix for a review finding is held to the standard the finding was raised under. Apply it to the
   fix's *own* output, not only to the code it corrects. Every regression in the originating
   repository's history arrived in a review fix, and three consecutive reviews of one change blocked
   on fixes that shipped a fresh instance of the fault they were closing.

   Before committing a group containing `RN.X` tasks, confirm all four:

   a. **Every guard the fix added has a test that fails when the guard is removed.** Not "is
      covered" — removed or inverted, package run, seen red, restored. Record the mutation in a
      comment on the test, as the project's standards require — not in the `tasks.md` entry, which
      stays one line.
   b. **The coverage profile, then the uncovered-lines report for each package the fix touched**,
      one invocation per package. Assert it in the commit message: `Coverage-checked:
      internal/store, internal/cli`. The `test-cover` first is not optional — `cover-gaps` reads a
      gitignored `coverage.out` that nothing regenerates, so a stale profile satisfies the condition
      silently. A package whose floor is above zero is reported with its residue, not declared
      clean.
   c. **The gate passes** — format, lint and test, plus any suite the touched surface needs.
   d. **The fix does only what the finding asked.** A fix that adds a mechanism, changes an
      interface, or refactors across package boundaries is not a review fix — it is new scope
      wearing one. Stop, and take it through `/wf-update` + `/wf-review-proposal`, which is
      the only path on which a design gets reviewed before it is written.

      This is the fault that has cost the originating repository the most per line. A review-2 fix
      once wrote a claim broader than the code it described; two rounds later that one sentence was
      a mandate for nine tasks of production work no proposal had asked for, plus three further
      review passes. Describe what the code does; do not write down an aspiration and then be bound
      by it.

   **If a fix cannot be implemented as written, do not approximate it.** Say so, record the
   deviation with its evidence in the `Deviations from review N's recommendations` section of
   `tasks.md`, and implement what the finding was actually protecting. A review's model of the
   code is sometimes wrong; implementing a prescription you have disproved is how a fix becomes
   a bug. If the fix requires a new mechanism or an interface change, stop and escalate to
   `/wf-update` + `/wf-review-proposal` rather than designing it here.

6. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

7. **Addendum — recommended test plan** (run when the apply session concludes: all tasks complete, or you're wrapping up a partial session)

   a. Summarize the work completed this session, including any task groups left incomplete (see step 6).

   b. Present the user with a **Recommended Test Plan** — concrete steps and commands to verify the
      functionality works as intended (e.g. the project's test command, named packages or suites,
      manual steps, example requests). Prefer the project's real commands.

   c. Write `changes/<name>/test_plan.md`. If it already exists, **merge** with the existing content (do not clobber it) so it stays a comprehensive test plan for future readers.

   d. Commit it — per the Apply checkpoint:
      ```bash
      git add "changes/<name>/test_plan.md"
      git commit -m "docs(changes): test-plan <name>"
      ```
      Skip this commit if `test_plan.md` is unchanged. Defer the addendum if apply paused mid-task awaiting clarification.

8. **Close the report with a recommendation on whether to review**

    The last thing the report says is whether `/wf-review` is worth a session. A round costs
    roughly what the apply session cost, so the decision gets made either way — ending with
    "Next: `/wf-review`" just makes it silently and always in the same direction.

    **State the action, not a confidence about the action.** One of exactly three:

    - **Skip the round**, naming the cheaper check that replaces it. Available **only** when all
      four conditions hold: no new mechanism, interface or package boundary was authored; every
      guard added is mutation-proven red with the mutation in a test comment; every **clause** of
      every behaviour the proposal promised is pinned by a named test; and the production diff is
      small enough that a reader can hold it in their head.
    - **Review, scoped to the surface you name** — the default when any one of the four is unmet.
    - **Run `/wf-review`** — any new mechanism, any guard added without a failing test, or a
      production diff large enough that its own author cannot enumerate its edges.

    Justify it with **how many of the four conditions are unmet**, and which. That number is
    derived from facts about the session, so it needs no calibration and cannot be talked up or
    down; "unmet" carries its own direction, so zero is unambiguously good.

    Two earlier forms are recorded because this line has now been rewritten twice. It was a
    confidence that a round was **unnecessary**, so "High" meant skip and the band a reader
    associates with risk licensed the least checking. Inverting it to "necessary: Low" fixed the
    double negative and left the indirection — a band still has to be translated into a decision.
    A **percentage** was considered and rejected: it needs its legend restated every time, it
    clusters on three values anyway, and a number nobody can defend to a tenth is not one a reader
    can disagree with. The bands were only ever labels for the three actions above.

    Report the six signals in the output template below. Each is a fact about the session rather
    than a judgement, which is the point: the recommendation is defined by what the facts license,
    not by how the work felt.

    **The recommendation is about the round, never about the code.** Skipping is a claim that a
    *cheaper check covers the same surface* — never that the surface is clean. In the session this
    step was added from, skipping review 2 was the right call **and** the targeted check that
    replaced it still found a claim describing code that did not exist. So: name the check, then
    run it. A skipped round is a substituted check, not an absent one.

    **Do not recommend skipping while any test written this session is verified only at whole-claim
    granularity** — count it as a condition unmet. A test's name is a claim, and each clause of that
    claim needs exercising. A test named, say, "the record is saved **and the cache is cleared**"
    can demonstrate the first half and not the second while the second half is false. A test
    existing per claim is not the check; a test exercising each clause is.

    **Weigh provenance.** If this session's work was `RN.X` review fixes, a following round would be
    reviewing review-derived work, which the provenance gate permits to block only on a
    user-observable defect — so the round's conclusion is largely predetermined. Say so, and prefer
    the targeted check. If the session implemented the proposal's *What Changes*, a round has
    proposed work to review and that argument for skipping is weaker.

    **Never soften the recommendation because you authored the work.** The assessment is being
    made by whoever just wrote the code, which is the one perspective that cannot see its own
    blind spot, and the bias runs one way: toward skipping, because skipping is what ends the
    session. Where a signal is unmeasured, report it as unmeasured rather than as passing — an
    unrun `cover-gaps` and a clean one are indistinguishable in a report that omits both.

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

**Output On Completion**

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

Test plan written to `test_plan.md`.

### Review Recommendation

**<Skip the round — run <check> instead | Review, scoped to <surface> | Run `/wf-review`>**

Conditions unmet: <n> of 4<, and which>.

<one to three further lines only where the count does not speak for itself — provenance, or a
 signal below that is unmeasured rather than passing>

| Signal | This session |
|---|---|
| Production lines changed | <n, or "deletions only"> |
| New mechanism, interface or package boundary | <none / what> |
| Guards added, and mutation-proven red | <n of n> |
| Behaviours promised, and pinned by a named test | <n of n> |
| Provenance of this session's work | <proposal's What Changes / prior review's RN.X> |
| Artifact volume | <n lines — inside/above the one-round band> |

**What would change this:** <the specific finding that would move the recommendation>

All tasks complete! Next: <`/wf-review`, or the named check then `/wf-archive`>.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**
- **Seed the todo list from `tasks.md` before writing any code** (step 3), every session,
  including a resumed one. The harness has no view into `tasks.md`, so a session that skips this
  runs with the user unable to see the plan or the progress — which is the most common way this
  skill has been run wrong.
- **`tasks.md` is authoritative; the todo list mirrors it.** One todo per unticked task, labelled
  with the task's identifier, exactly one `in_progress`. Reconcile the mirror at the group commit
  (step 4), which is the only step in the loop that cannot be skipped.
- Keep going through tasks until done or blocked
- Always read the change's artifacts before starting
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Auto-commit once per task group (bundling code with its checkbox updates) per the project's commit
  policy
- **A group containing `RN.X` review fixes is not committable until step 5's four conditions
  hold.** A fix that adds an unverified guard has moved the fault rather than closed it, and
  nothing mechanical will notice.
- **A fix does only what its finding asked** (step 5d). If you are adding a mechanism
  inside a review fix, stop and escalate via `/wf-update` + `/wf-review-proposal`.
- **Never design in a review fix.** If an `RN.X` task calls for a new mechanism or an interface
  change, stop and escalate to `/wf-update` + `/wf-review-proposal`.
- **Record every deviation with its evidence** in `Deviations from review N's recommendations`
  in `tasks.md`. A silently-approximated fix reads as done at the next review.
- **A decision this session measured gets its record, as an appended task in the group that
  produced it** (step 4). The measurement behind a rejected alternative exists only during apply;
  leaving it uncaptured makes the next change repeat it. A decision that changes *direction*
  escalates instead.
- Pause on errors, blockers, or unclear requirements - don't guess
- On wrap-up, present a recommended test plan and write/merge `changes/<name>/test_plan.md`,
  committing it per the Apply checkpoint (`docs(changes): test-plan <name>`)
- **Close the report with a review recommendation** (step 8): one of the three actions, how many
  of the four conditions are unmet, the six signals, and what would move it. Skipping names the
  cheaper check *in the recommendation itself* — a recommendation to skip with no named substitute
  is a recommendation to stop checking.
- **A claim is not pinned until a test exercises every clause of it.** Verifying per whole claim
  rather than per clause is how a test can assert something that does not happen and still reach a
  commit. Until it is done per clause, that is a condition unmet, so skipping is not available.

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
