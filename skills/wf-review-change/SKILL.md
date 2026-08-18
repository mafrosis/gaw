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

This is an **agent-driven** operation. The deep review is delegated to the `review`
subagent (Task tool); you orchestrate context resolution, then persist findings to
`review.md`, **close the trivial ones yourself**, and record the rest as `RN.X` tasks in
`tasks.md` for `/wf-implement`.

This step **never changes production behaviour**. It may fix a test or a document; a fix that
alters what the service does is a task, always. That line is the whole of the rule, and step 5
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

Every review MUST look for these by hand, because the linter and a green test suite both pass while
they are present.

1. **A guard with no test that fails when the guard is removed.** Coverage cannot see this: a
   line executed by a test that would pass without it reads exactly like a pinned line.
   Establish this by **mutation** — delete or inverse the guard in a scratch copy, run the
   package, restore. Report per guard, not per package.

   This is the class that matters most now that there is no spec corpus. A test is the only durable
   statement of intended behaviour the project keeps, so a behaviour whose test cannot fail is a
   behaviour nothing records.

2. **A gap between what the proposal promised and what the code does**, in either direction.
   Read `proposal.md`'s *What Changes* against the code: something promised and absent, and
   something built that the proposal never asked for.

   **The default resolution for the second direction is to drop the work, not to finish it.**
   Work no proposal asked for is scope that arrived without a decision — see the provenance
   gate in step 5. Recommending that it be completed requires naming the user-visible
   consequence of its absence.

   Stated as a default because the expensive branch became one by accident. A review fix once
   claimed more than the code did; two rounds later a nine-task group existed to close the gap,
   and nobody weighed deleting the claim against writing production code for a surface whose
   callers did not exist.

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

- **Production code.** Not a Go statement outside a `_test.go` file, not anything under
  `app/src/`. A finding whose fix would is a task, without exception, and that is what keeps
  this step's blast radius the size of a test.
- **`proposal.md` or `design.md`**, even when a finding is plainly correct. Those are pre-apply
  artifacts and the workflow's only design gate (`/wf-review-proposal`) sits before apply. A
  plan revised here is a plan nobody reviewed.

That second bar is the mirror of `/wf-review-proposal`, which **does** rewrite those artifacts
freely because nothing is built when it runs. Once code exists the asymmetry inverts: a `design`
finding is escalated to `/wf-update` (revise the artifacts) then `/wf-review-proposal` (review the
revision). See "The proposal is corrected before apply, not after".

**A fix this step makes is held to the same standard as an `RN.X` fix.** the review-fix rules are
not about which command applied the fix. So a test added here is confirmed red against the mutation
it defends, with that mutation recorded in a comment on the test, and The gate — format, lint and
test, plus any suite the touched surface needs — passes before the commit. A trivial fix is trivial
in size, never in evidence.

**What is not under review, at all:**

- **`review.md` — this change's or any other's.** It is a dated record of a past reading, not a
  live claim, and it is *never* a source of findings. Do not audit it for staleness, accuracy,
  drifted line numbers, or a test name that has since been renamed. You read it for exactly two
  things: the review number `N`, and which `R(N-1).X` items to judge. Nothing else in it is
  evidence, and nothing in it is a defect you may report.
- **Narration in `tasks.md`.** Prose describing how a previous fix was verified is not a behaviour
  and cannot be wrong in a way that matters. The project's standards forbid that narration existing;
  do not generate findings about it where it does.
- **`test_plan.md`, beyond a command that does not run.** A stale sentence in it is not worth a
  round.

The reason is measured. Reviewing prose produces prose findings, whose fixes are more prose, which
the next round then verifies — seven of the eight findings across one change's rounds 2–4 were
prose-versus-code mismatches and not one was a service defect. Judge the **code** against the
change's artifacts. If a document disagrees with the code, the finding is one line naming both.

**Brevity is a correctness property of a review, not a courtesy**

Artifact volume predicts review rounds almost exactly across the originating repository's history:
472 lines → 1 round, 1,365 → 1, 2,267 → 2, 3,240 → 3, 3,881 → 4. Prose makes claims, the next round
verifies claims and finds the drift the prose created. The worst instance reached 1,561 lines and
16,330 words to yield 69 tasks against 2,990 lines of production code — every finding written twice
at near-full length, once in `review.md` and again in its task, about 330 words each.

- **State each finding once**, in `review.md`. The task is the action in one line, never a
  restatement of the evidence.
- **Length is earned by severity.** A finding whose fix changes executable behaviour gets the
  evidence, the reproduction and the mutation proving it. Documentation debt gets one line. Most
  findings are one to three lines.
- **Do not inventory what is correct.** Confirmations, positives and "checked and currently
  true" collapse to at most one line per Focus Area, or are omitted. No praise.
- **Budget:** if your `## Review N` section is longer than the change's `design.md`, you are
  narrating rather than reviewing. Cut prose before cutting findings.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `changestat` and use the **question** tool to let the user select

   Always announce: "Reviewing change: <name>" and how to override (e.g., `/wf-review <other>`).

2. **Resolve change context**

   Read every artifact in `changes/<name>/`: `proposal.md`, `design.md`, `tasks.md`, and `review.md`
   if earlier rounds exist. Read the project's own standards, and the decision records that the
   change touches.

   ```bash
   changestat CHANGE=<name>
   ```

3. **Determine the review number N**

   Read `changes/<name>/review.md` if it exists. Set `N` to the highest existing
   `## Review K` number + 1; otherwise `N = 1`.

4. **Delegate the deep review to the `review` subagent**

   Use the Task tool (subagent_type: "review"). The prompt MUST include:
   - the change name and its artifact paths (proposal, design, tasks)
   - the Focus Areas above **and the two classes no mechanical check can find**
   - **what is under review and what is not** — in particular that `review.md` is never a source of
     findings, and that prose findings are the loop the measurement above already paid for
   - **the brevity rules above**, including the budget and the one-line rule for
     documentation debt. Instruct it to return findings, not an essay: each finding is a
     claim plus its evidence, and nothing else
   - the project's own standards and its relevant decision records
   - the grounding requirements below, which the subagent MUST report on explicitly
   - instruction to work through `tasks.md` sequentially, verify the implemented code adheres to the
     proposal and design, and **return markdown only (do not write files)** containing:
     a. findings organized by Focus Area, each with `file:line` references
     b. each finding classified `Blocking` / `Should fix` / `Non-blocking`, and tagged
        `correctness` | `verification` | `docs` | `design` | `cleanup` (see step 5)
     c. **for each finding, what its fix would touch** — `test-only`, `doc-only`,
        `production`, or `plan` — because that is what step 5 routes on, and the subagent that
        read the code is best placed to say. A finding whose fix it cannot size says so.
     d. a verdict (see scale below)
     e. a numbered list of recommended fixes (empty if none)

   **Grounding requirements.** State the result of each, and say plainly when one was not run:
   - the project's format, lint and test commands, plus any suite the touched surface needs
   - read `proposal.md`'s *What Changes* against the code, in both directions: promised and
     absent, and built but never asked for. Nothing checks this.
   - the coverage profile, then the uncovered-lines report **once per touched package, separately**.
     A space-separated list is not a substitute; report the per-package output.
   - mutation of every guard the change added, per class 1 above
   - the project's invariants check, and read its invariants index against the change in both
     directions: a universal invariant the change introduced or altered with no row, and a row the
     change made wrong. The checker resolves citations, so it catches a renamed test; nothing
     catches a row that was never added, or one whose claim the change quietly narrowed.
   - if the review is `N > 1`, judge each `R(N-1).X` item as *genuinely fixed* rather than ticked,
     by mutation — and check whether the fix itself introduced a new instance of either class. Every
     regression in the originating repository's history arrived in a review fix, not in an apply.
   - a tool that reports "no findings" is not evidence until you have seen it report a
     finding you planted. An empty report and a broken invocation are indistinguishable.

5. **Triage: route every finding to one of three dispositions**

   Classify each finding, then route it. **The route is determined by the finding, not by
   asking.** Only the third route involves the user, and most rounds will have nothing in it.

   **Route A — `fix now`. Close it yourself, in this round's commit.**

   - `docs` — a wrong or stale sentence in `README.md`, an example config, a code comment, or a
     invariants-index row. Correct it.
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
     service does and that is what `/wf-implement`'s evidence gate exists for.
   - A **defect in what was implemented against what the proposal promised** — something
     promised and absent, or built and not asked for. The proposal is not in question here;
     the code's adherence to it is.

   Write these straight into `tasks.md` and say so in the report. They are not judgement calls:
   a bug is a task, and a proposal-adherence defect is a task.

   **Route C — `ask`. Present it to the user and write nothing until they answer.**

   Exactly two kinds of finding reach the user:

   - **A material finding about functionality whose resolution may need the plan changed** —
     it adds a mechanism, changes an interface, or refactors across a package boundary. This is
     the `design` tag. Recommend `/wf-update` then `/wf-review-proposal` so the new design is
     reviewed before it is written; a mechanism authored in a review fix is unreviewed design
     entering the tree at the one point in the workflow with no design gate.
   - **The proposal or design itself looks wrong** — not the code's fidelity to it, but the
     plan. Only the person who owns the objective can decide that, and no route this step
     controls can.

   **The resolution you recommend sets the route, not the most expensive one available.** A
   finding closable either by correcting a document or by adding a mechanism is `docs`, and it
   goes to route A. Record the mechanism as the alternative; the user *choosing* it is what
   escalates. Routing by the expensive branch sent a one-sentence correction through
   `/wf-update` + `/wf-review-proposal` for two reviews running, because the branch nobody
   recommended set the route.

   **Deferred, and on no route.** `cleanup` that touches code structure — duplication, renames, a
   refactor — is listed in a `Deferred — follow-up change` subsection of `review.md` and becomes
   neither a fix nor a task unless the user asks. Shipping twenty cosmetic edits alongside five bug
   fixes gives the cosmetic ones the same commit-and-move-on treatment as the bugs, and the
   originating repository's regressions came from exactly that: two small tidy-ups, each of which
   shipped a regression.

   **Why routes A and B do not ask.** The rule they replace made every finding a question, on the
   grounds that "a review that writes its own task list converts every observation into committed
   work" — three rounds on one change produced 21 tasks that way and 14 were later dropped. That
   evidence is real but it indicts the *cleanup* class, which is why cleanups are still deferred and
   still unasked-for. It says nothing about a bug or a stale comment. Gating those on a question
   bought no scheduling decision and cost a round trip every time.

   **Provenance gate — is the finding against work anyone asked for?**

   Work is **review-derived** if its task group is not traceable to `proposal.md`'s *What
   Changes*. Read the proposal against `tasks.md`; this needs no tooling and no git archaeology.

   A finding against review-derived work may **not** be `Blocking` unless it names a defect
   **observable by a user of the service**. Otherwise it is documentation debt — or, better, the
   work itself is dropped, and dropping it is the recommendation to make, because no proposal
   asked for it.

   Report the count: `Findings against review-derived work: n of m`. If most of a round's
   findings are review-derived, **that is the headline finding.** The change's own scope is
   finished and the review has begun reviewing the review's own accumulation. Say so plainly and
   recommend closing the change rather than fixing the tail.

   This is the termination condition, and it is why there is no cap on review rounds. A round limit
   is arbitrary and cuts good rounds off with bad. Provenance is not: rounds 1–3 of one change
   reviewed proposed work and found three user-visible defects — they paid for themselves. Round 4
   found one user-observable defect and five items of bookkeeping against a task group that a review
   had created four days earlier, and its own text planned a round five. The difference between
   those rounds is provenance, not number.

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

   Then run the gate: format, lint and test, plus any suite the touched surface needs, plus the
   invariants check if a row moved. Do not proceed until all pass. A review that commits a red tree
   has done more damage than the finding it closed.

   If a fix turns out to be larger than route A allows — it needs a production edit, or an
   existing assertion's expected value has to move — **stop and reroute it** to B or C. Say so in
   `review.md`. Discovering that mid-fix is information, not an obstacle.

8. **Write the route-B tasks**

   Append a `## Review N Findings` section to `tasks.md` with one `- [ ] RN.X <action>` line per
   route-B finding. No asking. Lead with which items block. One line each: the project's standards
   forbid narrating evidence into the artifact, and the evidence is already in `review.md`.

9. **Ask — only if route C has anything in it**

   If route C is empty, **ask nothing** and go to step 10. That is the common case.

   Otherwise present only the route-C findings, with your recommendation for each, and wait. For
   a `design` finding the recommendation is `/wf-update` then `/wf-review-proposal` — never the
   implementation, and never a mechanism prescribed in an `RN.X` line. For "the proposal looks
   wrong", the recommendation is which part of it you believe is wrong and why; the decision is
   the user's.

   Write whatever they approve into `tasks.md`, as one line each.

   **A review may not create meta-work.** A finding that a tool or a `Makefile` target would help is
   recorded as a finding, not turned into a change. The project's standards cap meta-work at one
   change in flight and reserve that decision for the user.

10. **Commit — once, with everything** — per the Review checkpoint:

    ```bash
    git add "changes/<name>/review.md" "changes/<name>/tasks.md" <files fixed in step 7>
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
behaviour** — a Go statement, a `Makefile` recipe, a `.golangci.yaml` setting, or a test
assertion? Not "is it important"; that judgement is what let three rounds of prose findings read
as blocking.

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

**Output On Success**

```
## Review N Complete: <change-name>

**Verdict:** <verdict>
**Findings:** <count> (Proposal: n, Quality: n, Security: n, Tests: n, ...)
**Fixed in this commit:** <count> (route A — tests and docs, gate green)
**Tasks written:** <count> (route B — bugs and proposal-adherence defects)
**Awaiting your decision:** <count> (route C — design, or the proposal itself)
**Review-derived:** <count> of <total> (against work no proposal asked for; user-observable: n)
**Deferred:** <count> (structural cleanups; neither fixed nor tasked)
**Grounding:** fmt/lint/test <result>; cover-gaps per package <result>; guards mutated <count>
**Written:** review.md (Review N) — <lines> lines against design.md's <lines>

<if route C is non-empty: present those findings and ask. Otherwise say nothing and stop —
 the round is complete and the next step is /wf-implement or /wf-archive.>
```

**Guardrails**

- Favor simple, yet high quality code. Ensure the change delivers what its proposal promised.
- Keep recommendations tightly scoped to the change's intended outcome.
- Read the project's own standards and its relevant decision records before reviewing.
- **Never change production behaviour.** No Go statement outside a `_test.go` file, nothing
  under `app/src/`. Those fixes are `RN.X` tasks implemented via `/wf-implement`, which is where
  the evidence gate lives.
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
- **Never author a design in a review.** A finding may say a design is wrong; the replacement goes
  through `/wf-update` + `/wf-review-proposal` — never through an edit to `design.md` made here, and
  never through a mechanism prescribed in an `RN.X` task. Prescribing a mechanism is how a review
  ships a bug, and a wrongly-worded prescription is worse than none, because a one-word slip in it
  becomes the defect, and it takes a further review to find.
- **A later review may downgrade a prior `design` escalation, never upgrade one.** When the
  resolution now recommended changes no executable behaviour, re-tag it `docs` and close it with
  one `RN.X` line. This is the single exception to `review.md` not being under review: you may
  read a prior round's tag to *lower* the cost of closing it, never to raise it. Upgrading is how
  a review invents design work; without the downgrade an escalation is unappealable, because the
  only record of it lives in two files no later review may challenge.
- **Respect the scope cap** (step 5). More than ~500 production lines of recommended fixes
  means the change needs a new proposal, not a longer findings list.
- **Respect the provenance gate** (step 5). A finding against work no proposal asked for blocks
  only if a user of the service can observe the defect. Prefer recommending that the
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
