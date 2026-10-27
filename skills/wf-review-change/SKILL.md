---
name: wf-review-change
description: Review the implementation of a change for quality and adherence to what it proposed. Use after apply and before archive to verify implemented code meets the proposal.
license: MIT
metadata:
  author: mafrosis
  derived-from: "OpenSpec, https://github.com/Fission-AI/OpenSpec"
  version: "1.0"
---

Review the implementation of a change for quality and adherence to what it proposed.

> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.** POLICY.md
> holds the workflow's rules; PROJECT.md resolves every `{slot}` below into this project's actual
> command or path. **If PROJECT.md is missing, or names paths this project does not have, run POLICY.md's
> "Bootstrap" first.** A slot left empty or `none` is **skipped, and you say it was skipped** — an
> unrun check and a passing one must never read alike.

This is an **agent-driven** operation. The deep review is delegated to the `general`
subagent (Task tool); you orchestrate context resolution, then persist findings to
`review.md`, **close the trivial ones yourself**, and record the rest as `RN.X` tasks in
`tasks.md` for `/wf-implement`.

This step **never changes production behaviour**. It may fix a test or a document; a fix that
alters what the software does is a task, always. That line is the whole of the rule, and step 5
routes every finding by it.

**Input**: Optionally specify a change name (e.g., `/wf-review add-auth`). If omitted,
check if it can be inferred from conversation context. If vague or ambiguous you MUST
prompt for available changes.

**Focus Areas**

* Delivering What the Proposal Promised, & Project Standards
* Code Quality & Best Practices
* Removing Logic Duplication
* Bugs & Edge Cases
* Security: verify untrusted inputs are sanitized (especially SQL injection, XSS, command injection)
* Testing Coverage
* Documentation

**Two classes no mechanical check can find**

Every review MUST look for these by hand, because `{lint}` and a green `{test}` both
pass while they are present.

1. **A guard with no test that fails when the guard is removed.** Coverage cannot see this: a
   line executed by a test that would pass without it reads exactly like a pinned line.
   Establish this by **mutation** — delete or invert the guard, run the suite, restore. Report
   per guard, not per module.

   This is the class that matters most, because a test is the only durable statement of intended
   behaviour a project keeps — see `POLICY.md`'s "Behaviour is described by tests". A behaviour
   whose test cannot fail is a behaviour nothing records.

2. **A gap between what the proposal promised and what the code does**, in either direction.
   Read `proposal.md`'s *What Changes* against the code: something promised and absent, and
   something built that the proposal never asked for.

   **The default resolution for the second direction is to drop the work, not to finish it.**
   Work no proposal asked for is scope that arrived without a decision — see the provenance
   gate in step 5. Recommending that it be completed requires naming the user-visible
   consequence of its absence.

**What is under review**

Code, tests, the change's `proposal.md` and `design.md`, and the operator-facing documentation
the change touched. That is the whole scope.

**What this step may write**

Three things, all in **one** commit:

1. `changes/<name>/review.md` — always.
2. `changes/<name>/tasks.md` — the `RN.X` lines for findings that are not closed in place.
3. **The test and documentation files a trivial finding is closed by**, per step 5's
   `fix now` route.

It may **not** write:

- **Production code.** Nothing under `{production-roots}` except a file matching
  `{test-patterns}`. A finding whose fix would is a task, without exception, and that is what
  keeps this step's blast radius the size of a test.
- **`proposal.md` or `design.md`**, even when a finding is plainly correct. Those are pre-apply
  artifacts and the workflow's only design gate (`/wf-review-proposal`) sits before apply. A
  plan revised here is a plan nobody reviewed.

That second bar is the mirror of `/wf-review-proposal`, which **does** rewrite those artifacts
freely because nothing is built when it runs. Once code exists the asymmetry inverts: a `design`
finding is escalated to `/wf-update` (revise the artifacts) then `/wf-review-proposal` (review the
revision). See "The proposal is corrected before apply, not after" in
`.opencode/workflow/POLICY.md`.

**A fix this step makes is held to the same standard as an `RN.X` fix.** `POLICY.md`'s review-fix
rules are not about which command applied the fix. So a test added here is confirmed red against
the mutation it defends, with that mutation recorded in a comment on the test, and
`{gate}` — including every conditional gate `PROJECT.md` names for the surface touched —
passes before the commit. A trivial fix is trivial in size, never in evidence.

**What is not under review, at all:**

- **`review.md` — this change's or any other's.** It is a dated record of a past reading, not a
  live claim, and it is *never* a source of findings. Do not audit it for staleness, accuracy,
  drifted line numbers, or a test name that has since been renamed. You read it for exactly two
  things: the review number `N`, and which `R(N-1).X` items to judge. Nothing else in it is
  evidence, and nothing in it is a defect you may report.
- **Narration in `tasks.md`.** Prose describing how a previous fix was verified is not a
  behaviour and cannot be wrong in a way that matters. `POLICY.md` forbids that narration
  existing; do not generate findings about it where it does.
- **`test_plan.md`, beyond a command that does not run.** A stale sentence in it is not worth a
  round.
- **`report.md`.** It is the change's rolling status record, rewritten by every stage. Read it for
  the decisions already taken; never raise a finding against it.

Reviewing prose produces prose findings, whose fixes are more prose, which the next round then
verifies. Judge the **code** against the tests and the proposal. If a document disagrees with the
code, the finding is one line naming both.

**Brevity is a correctness property of a review, not a courtesy**

Prose makes claims, and the next round verifies the claims and finds the drift the prose created —
so artifact volume drives review rounds.

- **State each finding once**, in `review.md`. The task is the action in one line, never a
  restatement of the evidence.
- **Length is earned by severity.** A finding whose fix changes executable behaviour gets the
  evidence, the reproduction and the mutation proving it. Documentation debt gets one line. Most
  findings are one to three lines.
- **Do not inventory what is correct.** Confirmations, positives and "checked and currently
  true" collapse to at most one line per Focus Area, or are omitted. No praise.
- **Budget:** if your `## Review N` section is longer than the change's `design.md`, you are
  narrating rather than reviewing. Cut prose before cutting findings.

**Scope**

The scope comes from the previous stage's hand-off (`next-scope`), which is implement's review
recommendation. With no hand-off, it is `whole`.

- **`whole`** — every step below.
- **`surface <what>`** — every step below, with the deep review and the grounding confined to the
  named surface. Say in `review.md` what was out of scope.
- **`targeted: <the check>`** — run the named check and `{gate}`, then write a `## Review N`
  section holding only the check, its result and any finding it produced, routed by step 5 as
  usual. Skip step 4's delegation. A targeted round satisfies archive's review gate, because it is
  a review: a substituted check, not an absent one.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `bun .opencode/workflow/changestat.ts` and use the **question** tool to let the user select

   Always announce: "Reviewing change: <name>" and how to override (e.g., `/wf-review <other>`).

2. **Resolve change context**

   Read every artifact in `changes/<name>/`: `proposal.md`, `design.md`, `tasks.md`, and
   `review.md` if earlier rounds exist. Read the workflow policy in
   `.opencode/workflow/POLICY.md` and the project slots in `PROJECT.md`, then the records under
   `{decisions-dir}` that the change touches.

   **Re-seed the todo list from this change's `tasks.md`**, including its `RN.X` review-fix entries,
   and discard whatever the session inherited. `tasks.md` is authoritative here as everywhere. The
   list mirrors *tasks*, so `review.md` is not tracked by it — a round's findings are not todos, and
   adding them makes the sidebar disagree with the file on the next `bun .opencode/workflow/changestat.ts` count.

   ```bash
   bun .opencode/workflow/changestat.ts -change <name>
   ```

3. **Determine the review number N**

   Read `changes/<name>/review.md` if it exists. Set `N` to the highest existing
   `## Review K` number + 1; otherwise `N = 1`.

4. **Delegate the deep review to the `general` subagent**

   Use the Task tool (subagent_type: "general"). If the Task tool is not available to you — this
   stage may itself be running as a subagent — do the deep review yourself, against the same
   brief. The prompt MUST include:
   - the change name and its artifact paths (proposal, design, tasks)
   - the Focus Areas above **and the two classes no mechanical check can find**
   - **what is under review and what is not** — in particular that `review.md` is never a
     source of findings, and that prose findings breed more prose findings
   - **the brevity rules above**, including the budget and the one-line rule for
     documentation debt. Instruct it to return findings, not an essay: each finding is a
     claim plus its evidence, and nothing else
   - the workflow policy (`.opencode/workflow/POLICY.md`), the project slots (`PROJECT.md`) and
     the records in `{decisions-dir}` that `POLICY.md`'s *"Which records a design must account
     for"* makes relevant
   - the grounding requirements below, which the subagent MUST report on explicitly
   - instruction to work through `tasks.md` sequentially, verify the implemented code adheres
     to the proposal and design, and **return markdown only (do not write files)** containing:
     a. findings organized by Focus Area, each with `file:line` references
     b. each finding classified `Blocking` / `Should fix` / `Non-blocking`, and tagged
        `correctness` | `verification` | `docs` | `design` | `cleanup` (see step 5)
     c. **for each finding, what its fix would touch** — `test-only`, `doc-only`,
        `production`, or `plan` — because that is what step 5 routes on, and the subagent that
        read the code is best placed to say. A finding whose fix it cannot size says so.
     d. a verdict (see scale below)
     e. a numbered list of recommended fixes (empty if none)

   **Grounding requirements.** State the result of each, and say plainly when one was not run:
   - `{gate}`, including every conditional gate `PROJECT.md` names for the surface touched
   - read `proposal.md`'s *What Changes* against the code, in both directions: promised and
     absent, and built but never asked for. Nothing checks this.
   - `{coverage}`, then `{coverage-gaps}` **once per touched package or module, separately**. A
     space-separated list is not a substitute; report each output. Where neither is declared, say
     so.
   - mutation of every guard the change added, per class 1 above
   - `git status --short` before returning, with the result stated. `general` has write access,
     so a mutation session's restores are verified rather than assumed — a missed restore is
     silent whenever the suite still passes. If the tree differs from how the round found it,
     that goes at the top of the report.
   - `{invariants}` (or say it is not declared), and read `{invariants-index}` against the change
     in both directions:
     a universal invariant the change introduced or altered with no row, and a row the change
     made wrong. The checker resolves citations, so it catches a renamed test; nothing catches
     a row that was never added, or one whose claim the change quietly narrowed.
   - **`{decisions-dir}` against the change, in both directions**, and report on each: a decision the
     change made that meets `POLICY.md`'s three tests and no record holds, and an accepted record
     whose sentences the change made false. Nothing mechanical checks either, and the second is
     missed more often because it is a file the change never opened. The two land on different
     routes in step 5 — marking a contradicted record is route A, a missing record is route C.
   - if the review is `N > 1`, judge each `R(N-1).X` item as *genuinely fixed* rather than
     ticked, by mutation — and check whether the fix itself introduced a new instance of
     either class. Review fixes are where regressions most often enter.
   - a tool that reports "no findings" is not evidence until you have seen it report a
     finding you planted. An empty report and a broken invocation are indistinguishable.

5. **Triage: route every finding to one of three dispositions**

   Classify each finding, then route it. **The route is determined by the finding, not by
   asking.** Only the third route involves the user, and most rounds will have nothing in it.

   **Route A — `fix now`. Close it yourself, in this round's commit.**

   - `docs` — a wrong or stale sentence in `{operator-docs}`, a code comment, or an
     `{invariants-index}` row. Correct it.
   - `docs` — **an accepted decision record the shipped change made false.** Mark it per
     `POLICY.md`: status `Accepted (amended)`, an amendment block naming the amending record, the
     `{decisions-index}` row. This is bookkeeping on a record whose decision was already taken,
     not design authorship; leaving it unmarked leaves a record stating something the code no
     longer does.
   - `verification` where the fix is **test-only and additive** — a missing case, a mutation
     comment that was never recorded, a vacuous assertion to delete.
   - `cleanup` that touches only prose or comments.

   These are the findings whose fix is smaller than the sentence describing it. Asking about
   them costs a round trip to be told "yes", and a review that stops to ask about a one-word
   comment correction is a review nobody runs.

   **Two things disqualify a finding from this route, however small the diff:**

   - **Changing an existing assertion's expected value.** Adding a case is additive; editing
     what a test expects means either the test was wrong (a `design` question — route C) or the
     code is (a bug — route B). A review that "fixes" a test by relaxing it has destroyed the
     evidence it exists to protect. Adding a case and deleting a provably vacuous one are the
     only two edits to existing test files this route permits.
   - **Any production-code edit.** See the write scope above.

   **Route B — `task`. Write the `RN.X` line without asking.**

   - `correctness` — a bug. Always a task, however small, because the fix changes what the
     software does and that is what `/wf-implement`'s evidence gate exists for.
   - A **defect in what was implemented against what the proposal promised** — something
     promised and absent, or built and not asked for. The proposal is not in question here;
     the code's adherence to it is.

   Write these straight into `tasks.md` and say so in the report. They are not judgement calls:
   a bug is a task, and a proposal-adherence defect is a task.

   **Route C — `ask`. Present it to the user and write nothing until they answer.**

   Three kinds of finding reach the user:

   - **A material finding about functionality whose resolution may need the plan changed** —
     it adds a mechanism, changes an interface, or refactors across a module boundary. This is
     the `design` tag. Recommend `/wf-update` then `/wf-review-proposal` so the new design is
     reviewed before it is written; a mechanism authored in a review fix is unreviewed design
     entering the tree at the one point in the workflow with no design gate.
   - **The proposal or design itself looks wrong** — not the code's fidelity to it, but the
     plan. Only the person who owns the objective can decide that, and no route this step
     controls can.
   - **The change decided something durable that no record holds** — it meets `POLICY.md`'s three
     tests and neither the proposal nor the apply session captured it. Say what the decision was,
     what the alternative was, and recommend `/wf-update` to add the task. **Do not write the
     record.** A review may mark a record the change contradicted (route A) but may not author a
     new one: a decision record written by a reader reconstructing intent is a guess with a date
     on it.

   **The resolution you recommend sets the route, not the most expensive one available.** A
   finding closable either by correcting a document or by adding a mechanism is `docs`, and it
   goes to route A. Record the mechanism as the alternative; the user *choosing* it is what
   escalates.

   **Deferred, and on no route.** `cleanup` that touches code structure — duplication, renames,
   a refactor — is listed in a `Deferred — follow-up change` subsection of `review.md` and
   becomes neither a fix nor a task unless the user asks. Cosmetic edits shipped alongside bug
   fixes get the same commit-and-move-on treatment as the bugs, and that is where a tidy-up
   introduces a regression.

   **Why routes A and B do not ask.** A bug is always a task and a stale comment is always a fix;
   asking about either buys no scheduling decision and costs a round trip. Cleanups, which *do*
   turn observations into unrequested work, are the class that is deferred.

   **Provenance gate — is the finding against work anyone asked for?**

   Apply `POLICY.md`'s "Review-derived work and the provenance gate". Work is **review-derived** if
   its task group is not traceable to `proposal.md`'s *What Changes*; a finding against it may not
   be `Blocking` unless it names a defect **observable by a user of the software**, and dropping
   the work is the preferred recommendation.

   Report the count: `Findings against review-derived work: n of m`. If most of a round's
   findings are review-derived, **that is the headline finding** — recommend closing the change
   rather than fixing the tail. This is the termination condition, and why there is no cap on
   review rounds.

   **Scope cap.** If the `RN.X` set you are about to recommend would take more than roughly
   500 lines of *production* change, stop. Do not recommend it. Return a verdict of
   `Changes required`, state that the gap is larger than a review can safely close, and
   recommend a new proposal. A review is not a second design pass.

6. **Write findings to `review.md`**

   Append a `## Review N` section to `changes/<name>/review.md` (create the file if absent),
   containing the verdict, the grounding results from step 4 as a single compact block, the
   findings by Focus Area each marked with its route, and the `Deferred — follow-up change`
   list from step 5. NEVER rewrite or renumber prior `## Review K` sections.

   Apply the brevity rules before writing, not after: each finding once, length earned by
   severity, documentation debt one line each, no inventory of what is correct, no praise, and
   the whole section no longer than the change's `design.md`. A summary is one short paragraph
   or none — the verdict and the counts already say it.

   If this is review `N > 2` and the same class has blocked at every review, add **two or three
   lines** naming the class and what would close it, so the next review acts on it rather than
   re-diagnosing it. Not a section.

7. **Close the route-A findings**

   Make each `fix now` edit. For a test added or changed, confirm it red against the mutation it
   defends and record that mutation in a comment on the test — the same standard `/wf-implement`
   holds an `RN.X` fix to.

   Then run `{gate}`, including every conditional gate `PROJECT.md` names for the surface
   touched, plus `{invariants}` if a row moved. Do not proceed until all pass. A review that
   commits a red tree has done more damage than the finding it closed.

   If a fix turns out to be larger than route A allows — it needs a production edit, or an
   existing assertion's expected value has to move — **stop and reroute it** to B or C. Say so in
   `review.md`. Discovering that mid-fix is information, not an obstacle.

8. **Write the route-B tasks**

   Append a `## Review N Findings` section to `tasks.md` with one `- [ ] RN.X <action>` line per
   route-B finding. No asking. Lead with which items block. One line each: `POLICY.md` forbids
   narrating evidence into the artifact, and the evidence is already in `review.md`.

9. **Ask — only if route C has anything in it**

   If route C is empty, **ask nothing** and go to step 10. That is the common case.

   Otherwise present only the route-C findings, with your recommendation for each, and wait. For
   a `design` finding the recommendation is `/wf-update` then `/wf-review-proposal` — never the
   implementation, and never a mechanism prescribed in an `RN.X` line. For "the proposal looks
   wrong", the recommendation is which part of it you believe is wrong and why; the decision is
   the user's.

   Write whatever they approve into `tasks.md`, as one line each.

   **A review may not create meta-work.** A finding that a tool or a task-runner target would
   help is recorded as a finding, not turned into a change. `POLICY.md` caps meta-work at one
   change in flight and reserves that decision for the user.

   **A finding about the workflow itself is applied directly, not tasked.** If a round concludes
   that a `wf-*` skill, a `wf-*` command, `.opencode/workflow/POLICY.md` or `PROJECT.md`, the task
   counter or the todo-sync plugin is wrong, that is a direct commit — see `POLICY.md`'s "The
   workflow is edited directly, never proposed". It is neither an `RN.X` task against the change
   under review (the change did not cause it and its author cannot close it) nor a new change (the
   bar above forbids that). Report it, then edit the file, with the workflow's own tests green and
   its own commit separate from this round's.

10. **Update `report.md`** per `POLICY.md`'s "The report": the round and verdict in "Where it
    stands", each decision the user took on a route-C finding in "Decisions and trade-offs", and
    the summary below as "Latest stage".

11. **Commit — once, with everything** — per the Review checkpoint in `POLICY.md`:

    ```bash
    git add "changes/<name>/review.md" "changes/<name>/tasks.md" "changes/<name>/report.md" <files fixed in step 7>
    git commit -m "docs(changes): review <name> (review N)"
    ```

    One commit per round, staged by explicit path, containing the findings, the fixes made in
    place, and the tasks left for `/wf-implement`. Never commit `review.md` before step 9 has
    answered: a round that commits its findings and then asks leaves the tasks in a second
    commit, and the round's record is then split across two.

**Verdict Scale**

The verdict says **what is left for someone else** once this round's commit lands. A finding
closed in place by route A leaves nothing, so it does not make the verdict `Changes required`;
report it as fixed and move on.

For anything not closed in place, the question is mechanical: **does fixing it change executable
behaviour** — a statement under `{production-roots}`, a build or task-runner recipe, a linter
setting, or a test assertion? Not "is it important", which lets prose findings read as blocking.

- **Approved** — no findings worth acting on.
- **Approved with fixes applied** — findings existed and every one went to route A. They are
  fixed in this round's commit, with the gate green. Nothing is left and no round follows.
- **Changes required** — at least one `RN.X` task remains, or a route-C finding is open, or the
  gap exceeds the scope cap and needs a new proposal rather than fixes.

A second, independent test applies to any finding against **review-derived** work (step 5): it
counts toward `Changes required` only if it is **user-observable**. A round whose remaining set is
entirely review-derived and none of it user-observable is `Approved with fixes applied`, and the
review-derived work is **dropped rather than completed**. Both tests must pass for a finding to
block — executable *and*, where review-derived, user-observable.

**Stage summary** — the "Latest stage" block in `report.md`

```
## Review N Complete: <change-name>

**Verdict:** <verdict>
**Findings:** <count> (Proposal: n, Quality: n, Security: n, Tests: n, ...)
**Fixed in this commit:** <count> (route A — tests and docs, gate green)
**Tasks written:** <count> (route B — bugs and proposal-adherence defects)
**Awaiting your decision:** <count> (route C — design, or the proposal itself)
**Review-derived:** <count> of <total> (against work no proposal asked for; user-observable: n)
**Deferred:** <count> (structural cleanups; neither fixed nor tasked)
**Grounding:** gate <result>; coverage gaps per module <result, or not declared>; guards mutated <count>
**Written:** review.md (Review N) — <lines> lines against design.md's <lines>

<next: implement for the RN.X tasks, or archive>
```

**Guardrails**

- Favor simple, yet high quality code. Ensure the change delivers what its proposal promised.
- Keep recommendations tightly scoped to the change's intended outcome.
- Read `.opencode/workflow/POLICY.md` and `PROJECT.md`, then the `{decisions-dir}` records its
  *"Which records a design must account for"* makes relevant.
- **Never change production behaviour.** Nothing under `{production-roots}` except a file
  matching `{test-patterns}`. Those fixes are `RN.X` tasks implemented via `/wf-implement`, which
  is where the evidence gate lives.
- **Fix the trivial findings; do not ask about them.** A stale comment, a missing test case, a
  vacuous assertion — close them in this round's commit. Route C (step 5) is the only route that
  reaches the user, and a round with nothing in it asks nothing at all.
- **Never relax an existing assertion.** Adding a test case is route A; changing what a test
  expects is a bug or a design question. A review that edits an assertion to match the code has
  destroyed the only durable record of the intended behaviour.
- **Hold your own fixes to the `RN.X` standard.** A test you add here needs its mutation proof
  and the mutation in a comment on it, and the gate green before the commit. Trivial in size,
  never in evidence.
- **One commit per round**, containing `review.md`, `tasks.md` and the files fixed in place.
  Never commit the findings and then ask.
- **Never edit `proposal.md` or `design.md`.** Correcting those pre-apply is
  `/wf-review-proposal`'s job and it does so freely; correcting them *post*-apply goes through
  `/wf-update` + `/wf-review-proposal`, because that is the only path on which a revised plan
  gets reviewed.
- **Never author a design in a review.** A finding may say a design is wrong; the replacement
  goes through `/wf-update` + `/wf-review-proposal` — never through an edit to `design.md`
  made here, and never through a mechanism prescribed in an `RN.X` task. Prescribing a mechanism
  is how a review ships a bug, and a wrongly-worded prescription is worse than none.
- **A later review may downgrade a prior `design` escalation, never upgrade one.** When the
  resolution now recommended changes no executable behaviour, re-tag it `docs` and close it with
  one `RN.X` line. This is the single exception to `review.md` not being under review: you may
  read a prior round's tag to *lower* the cost of closing it, never to raise it. Upgrading is how
  a review invents design work.
- **Respect the scope cap** (step 5). More than ~500 production lines of recommended fixes
  means the change needs a new proposal, not a longer findings list.
- **Respect the provenance gate** (step 5). A finding against work no proposal asked for blocks
  only if a user of the software can observe the defect. Prefer recommending that the
  review-derived work be dropped over recommending it be finished.
- **Never recommend finishing work no proposal asked for** without naming the user-visible
  consequence of its absence (class 2). Dropping it is the default.
- **Never raise a finding against `review.md`.** Not its own, not a prior round's. It is a dated
  record, exempt from the citation rules for that reason, and auditing it is how a review starts
  reviewing itself.
- **Say less.** A review's value is in what it found, not in demonstrating that it looked. If a
  finding needs a paragraph to justify why it matters, it is probably documentation debt.
- **Verify your own model of the code before recommending a change to it.** If you cannot
  construct the state a guard defends, say so and ask for the guard's rationale instead of
  recommending its removal or a test that cannot fail.
- A `Non-blocking` finding is not free. Prefer deferring cleanups to recommending them.
- Idempotent numbering: never overwrite prior `## Review K` sections; always append the next `N`.
- A behaviour worth keeping is worth a test that fails without it. That test is now the only
  durable record of it, so "it works" is not evidence — "it fails when broken" is.

## Hand-off

Then return the hand-off from `POLICY.md`'s "The hand-off":

- `Approved`, or `Approved with fixes applied` → `next: archive`, `stop: none`.
- `Changes required`, every open finding a route-B `RN.X` task → `next: implement`,
  `stop: none`. The flow's loop guard, not this stage, decides whether round 3 or later continues.
- Route C has findings → `stop: needs-input` at step 9, **before** committing, with each finding,
  its options and your recommendation. Resumed with the answers, finish steps 9–11 and hand off
  again: a design escalation the user accepted is `next: update` with the finding as the
  revision to make; tasks they approved are `next: implement`.
- The scope cap is exceeded, or most findings are review-derived → `stop: needs-input`,
  recommending a new proposal or closing the change.

As a `wf-flow` stage, every instruction above to ask the user becomes a `stop: needs-input`
hand-off carrying that question and your recommended answer; you are resumed with the answer and
continue from where you stopped. Loaded directly, outside `wf-flow`, load `wf-flow` and continue
from `next` instead of ending your turn — unless `stop` is not `none`.
