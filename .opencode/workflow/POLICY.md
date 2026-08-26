# Workflow policy

The rules of the change workflow itself. This file is **project-neutral**: it is part of the
`.opencode/` bundle and moves with it. Everything that varies between projects — the gate
commands, which directories hold production code, where decision records live — is declared in
`PROJECT.md` beside this file.

Read this with `PROJECT.md`. Neither is complete alone.

## How to read a slot

A name in braces is a **slot**, resolved through `PROJECT.md`:

- `{format}` `{lint}` `{test}` — the three required commands.
- `{gate}` — shorthand for `{format}` then `{lint}` then `{test}`, plus any conditional command
  `PROJECT.md` declares for the surface being changed (`{integration-test}`, `{ui-test}`,
  `{workflow-test}`).
- `{production-roots}` `{test-patterns}` — path sets, not commands.

**A slot `PROJECT.md` leaves empty is skipped, and the step that wanted it says so.** An unrun
check and a passing one must never read alike; that asymmetry is the fault this whole file is
most concerned with.

## What is fixed, and not a slot

These are properties of the workflow, so a project does not get to configure them:

| Fixed | What it is |
|---|---|
| `changes/<name>/` | where a change lives |
| `proposal.md` `design.md` `tasks.md` | the three artifacts every change holds |
| `review.md` `test_plan.md` | added once those steps have run |
| `changes/archive/YYYY-MM-DD-<name>/` | where an archived change lands |
| `- [ ] N.X` / `- [ ] RN.X` | the task and review-fix checkbox forms the counter and the plugin both parse |

## On the measurements in this file

Every number and named example below was measured in the repository this workflow was developed in.
They are **provenance for the rule**, not citations you can look up in the project you are reading
this in. They are kept because a rule with its measurement attached survives contact with a session
that would rather not follow it, and a bare rule does not.

---

## The pipeline

`/wf-propose` → `/wf-review-proposal` → `/wf-implement` → `/wf-review` → `/wf-archive`, with
`/wf-update` available ad hoc and `/wf-explore` available at any point.

A change lives in `changes/<name>/` and holds three artifacts — `proposal.md` (why), `design.md`
(how), `tasks.md` (the ordered checklist) — plus `review.md` and `test_plan.md` once those steps
have run.

**There is no spec artifact.** See "Behaviour is described by tests" below.

## Git commit policy

Commits are made **automatically** at the checkpoints below. This is a standing instruction — do
not ask for per-commit confirmation at these points.

### Checkpoints

1. **Propose** — after `/wf-propose` creates or updates a change's artifacts and they are
   coherent, commit them in a single commit:
   - Message: `docs(changes): propose <change-name>`
   - Scope: `changes/<change-name>/` (proposal.md, design.md, tasks.md)

2. **Review Proposal** — after `/wf-review-proposal` critiques a change and revises its proposal
   artifacts (editing them directly — see "The proposal is corrected before apply, not after"),
   commit them:
   - Message: `docs(changes): review-proposal <change-name>`
   - Scope: `changes/<change-name>/` (proposal.md, design.md, tasks.md)
   - Skip the commit only if the review made no edits. The verdict's name does not decide it: a
     `Sound` plan that is parked still records its precondition in `proposal.md`, and that is an
     edit.

3. **Apply** — during `/wf-implement`, commit once per task group (each `## N` heading in
   `tasks.md`), bundling that group's code changes with its `- [x]` checkbox updates:
   - Message: `<type>(<scope>): <group summary> [<change-name>]`
   - `<type>` is one of `feat` `fix` `refactor` `test` `docs` `build` `chore`
   - Commit only after the group's work satisfies its tasks — it builds and `{gate}` passes.
   - At the end of an apply session, also write/merge `changes/<change-name>/test_plan.md` (a
     recommended test plan) and commit it separately: `docs(changes): test-plan <change-name>`.

4. **Review** — after `/wf-review` writes findings, closes the trivial ones and records the rest
   as tasks, commit all of it **together**:
   - Message: `docs(changes): review <change-name> (review N)`
   - Scope: `changes/<change-name>/review.md`, `tasks.md` (the `Review N Findings` section), and
     the test or documentation files the round fixed in place
   - **One commit per round.** A round that commits its findings and then asks about tasks splits
     its own record across two commits.

5. **Archive** — after `/wf-archive` moves the change to `archive/`, commit the result:
   - Message: `chore(changes): archive <change-name>`
   - Archiving is a `git mv` into `changes/archive/YYYY-MM-DD-<change-name>/`; nothing is merged
     anywhere, because there is no spec corpus to merge into.

6. **Update** (ad hoc — not part of the linear pipeline) — after `/wf-update` revises a change's
   planning artifacts and leaves them coherent, commit the revised files:
   - Message: `docs(changes): update <change-name>`
   - Scope: the revised artifacts under `changes/<change-name>/`
   - Skip the commit if no edits were made, or if `/wf-update` was invoked as a delegated sub-step
     of another checkpoint that owns the commit (e.g. a large multi-artifact reconciliation handed
     to it by Review Proposal).

### Rules

- Auto-commit at the checkpoints above; keep the working tree clean between them.
- One logical change per commit. Stage explicit paths — never `git add -A` blindly.
- Run `{gate}` before committing, and do not commit until it passes. **`{lint}` is not optional**
  where `PROJECT.md` declares one: a project's linter is usually the only mechanical check on a
  class of fault, and a finding that is a deliberate choice is exempted at that line with the
  language's own suppression comment and a reason — never by broadening the linter's global
  configuration, which silences the next instance too.
- Never commit secrets, credentials, or build output.
- Never `git push`, force-push, amend already-published commits, or open PRs unless explicitly
  requested.
- If a commit or a hook fails, fix forward with a new commit — do not amend the failed one.

## The proposal is corrected before apply, not after

`/wf-review-proposal` **rewrites** the change's artifacts. That is what the step is for. Nothing
is built yet, so a task added or a design reworked costs only the edit. It edits `proposal.md`,
`design.md` and `tasks.md` directly, and asks the user only when a finding is genuinely ambiguous
or when closing it would change the change's **objective** rather than complete it. A proposal
review that finds a gap and declines to close it has not saved any work — it has moved the gap
into apply, which is the one place it is expensive.

The rule this replaces made a `Refine` verdict unavailable whenever the revisions added more tasks
than they removed, so a review that found a missing task had to return `Rework` and send the whole
change back to `/wf-propose`. It was aimed at a real fault — a pass that grew an already-reviewed
plan by two tasks and a scenario nobody asked for — but it measured the wrong thing. Task count is
not scope; the objective is. Adding three tasks because the stated objective cannot be met without
them is the step working. Adding one task that pursues a *new* objective is the fault, and that is
what `Rework` is now for.

**A verdict judges the plan; the schedule is a separate, recorded fact.** The same rule was wrong a
second way, for the same reason: it had no answer for a plan that is *right and cannot start yet*,
so a scheduling question came out as `Rework` — which means the plan is wrong. One change was
returned that way. Its review had checked three of its six design decisions against the records
they cite and found them sound, and raised eleven findings none of which touched the objective; the
recommendation was to discard all of it because another change held two files it needed, and that
blocker cleared the same day. So: a plan whose only obstacle is outside it is `Refine`, its
findings closed now, with a `Precondition:` recorded in its own `proposal.md` — the review's output
block is a chat message, and `/wf-implement` reads the artifact. **Parking never defers a finding.**
The corrections are cheapest while the reading of the code is fresh, and by the time a precondition
clears, a plan left uncorrected has to be re-read to be trusted — which is the cost this whole
section exists to avoid.

`/wf-review` is the mirror image. Once code exists, the review's write scope is `review.md`, the
`RN.X` lines in `tasks.md`, and the **test or documentation files a trivial finding is closed
by** — a stale comment, a missing test case, a vacuous assertion, an accepted record the change
contradicted. It never changes production behaviour: nothing under `{production-roots}` except a
file matching `{test-patterns}`, because that fix belongs to `/wf-implement` where the evidence
gate lives. It never edits `proposal.md` or `design.md`, and it never writes a *new* decision
record. A `design` finding is escalated — `/wf-update` to revise the artifacts, then
`/wf-review-proposal` to review the revision — and the reason is in "A review does not author
designs" below: the workflow's only design gate sits pre-apply, so a mechanism written into
`design.md` by a post-apply review is unreviewed design entering the tree.

Three kinds of finding reach the user for a decision: one whose resolution may need the plan
changed, one saying the plan itself is wrong, and one naming a durable decision the change made
that no record holds — a review reports that and never writes the record, per "A decision the next
change would re-litigate gets a record" below. A bug is a task without asking; a stale sentence is
fixed without asking, and so is marking a record the change contradicted. Gating those on a
question bought no scheduling decision and cost a round trip every time.

## A review fix is held to the standard its finding was raised under

A task group containing `RN.X` review-fix tasks is committable only when all four hold. **So is a
fix `/wf-review` made in place** — the standard is a property of the finding, not of the command
that closed it, and a test added by a review with no mutation proof is the same untested guard it
was raised against.

1. **Every guard the fix added has a test confirmed to fail without it** — removed or inverted,
   the suite run, seen red, restored. Record the mutation in **a comment on the test**:
   `Fails without the <X> guard: <mutation>`. It belongs next to the thing it describes, where it
   is read when the test is next edited.
2. **`{coverage}`, then `{coverage-gaps}` for each package or module the fix touched**, one
   invocation each. Assert it in the commit message: `Coverage-checked: <the units>`. Running
   `{coverage}` first is not optional — `{coverage-gaps}` reads a profile that nothing else
   regenerates, so a stale profile satisfies the condition silently. Where `PROJECT.md` declares
   neither, say the check was unavailable rather than passing over it.
3. **`{gate}` passes**, including any conditional command for the surface touched.
4. **The fix does only what its finding asked.** A fix that adds a mechanism, changes an
   interface, or refactors across module boundaries is new scope wearing a fix's clothes —
   escalate it via `/wf-update` + `/wf-review-proposal` instead.

**A `tasks.md` entry for a review fix is one line**: `- [x] RN.X <what was done>`. Evidence lives
in the code, the test comment and the commit message — never narrated into the artifact. The
narration this rule used to demand grew one change's `tasks.md` to 1,493 lines, of which 1,350
were review apparatus against 143 lines of actual tasks. That prose is then what the next review
round audits, which is the loop.

The evidence for this being a rule rather than a nicety: three consecutive reviews of one change
blocked on fixes that shipped a fresh instance of the fault they were closing. Three of them were
a guard with no test that fails without it — each one a guard added *while fixing* an untested
guard. The mechanism is a single asymmetry: the review's standard was applied to the code apply
wrote, and not to the code the fix wrote.

**A review does not author designs.** All three regressions traceable to a review fix in that
change's whole history arrived in a review fix rather than in an apply — R1.12 produced R2.1 (from a
finding whose own wording prescribed the defect), R1.14 produced R2.2, and R2.14 produced R3.9. The
reason is structural: the workflow's only design gate, `/wf-review-proposal`, sits *before* apply,
so a mechanism authored in a review fix enters the tree at the one point with no design review. A
finding may say a design is wrong; the replacement goes through `/wf-update` +
`/wf-review-proposal`.

A `design` finding whose recommended resolution changes no executable behaviour is not a design
finding: it is a `docs` finding and costs one `RN.X` line. Tag by the resolution recommended, not
by the most expensive one available — a finding offering a choice between narrowing prose and
adding a mechanism is `docs` when the prose is what you recommend, and the user choosing the
mechanism is what escalates. A later review may downgrade a prior escalation on that test, never
upgrade one: one change's finding spent two rounds routed to a design gate for a one-sentence
requirement narrowing, because the branch nobody recommended set the route and no later round was
permitted to re-triage it.

**A fix that cannot be implemented as written is not approximated.** Say so, record the deviation
with its evidence in the `Deviations from review N's recommendations` section of `tasks.md`, and
implement what the finding was protecting. A review's model of the code is sometimes wrong, and
implementing a prescription you have disproved is how a fix becomes a bug.

## Behaviour is described by tests, not by a spec corpus

There is no `specs/` directory and no spec artifact in a change. The corpus that existed in the
originating repository was deleted, along with the audit that was the only thing able to detect its
drift, because it did not do the job it was kept for: the one audit ever run against it found much
of it stale, and zero defects. A document that must be verified before it can be trusted costs the
verification and can still mislead.

What replaces it, and where to look:

- **behaviour** → the tests. They cannot go stale, because they fail. A behaviour worth keeping is
  worth a test that fails without it; "it works" is not evidence, "it fails when broken" is.
- **which invariants are universal, and what enforces each** → `{invariants-index}`, checked by
  `{invariants}`, where `PROJECT.md` declares them. An index is allowed to exist at all, when a
  spec corpus was deleted for drifting, because of one distinction: the corpus asserted behaviour,
  which nothing could check without re-reading the system, where a row asserts "claim X is
  enforced by artefact Y" and whether Y exists is decidable by a program on every test run. An
  index nothing checks does not earn the exemption.
- **decisions and their rationale** → `{decisions-dir}`. Dated, and explicitly allowed to age, so
  a record is never wrong — only historical.
- **what a change intended** → its own `changes/archive/<date>-<name>/` directory, beside the code
  and the log it produced.

Two consequences follow for an invariant that is *universal* — "every write validates its
identifier", "every route requires identity". A hand-written test asserts one case and says nothing
about the set, which is how a set can quietly lose a member while prose is the only artefact
claiming "every". So:

1. **Prefer making it unrepresentable.** A field that does not exist, or a wrapper applied at a
   point every request passes through, cannot be got wrong. A type with no field for per-field
   state makes "this thing is never editable" a property of the type rather than a rule to
   remember.
2. **Otherwise write a test that derives its own scope** — reflect over the interface, walk the
   command tree, scan the AST — so a member added later cannot escape it. A test that scans every
   exported declaration is the model, rather than one that checks the declarations somebody
   remembered.

**Two mechanisms that sound like option 1 and are not.** Both were proposed, designed and rejected
on measurement in the originating repository.

- **A newtype whose constructor validates.** Its zero value is expressible wherever the type is, so
  the implementations still need a refusal — and the draft's task to delete "the validation the type
  makes unnecessary" would have removed a live guard. A newtype over a string is weaker still: any
  conversion compiles.
- **A per-item flag on a set a shared wrapper already covers.** When the wrapper applies the
  property, an item without it is *already* unrepresentable. A per-item flag would make it
  representable for the first time. That is the preference order backwards: a property held by
  construction, traded for one held by a flag and a test.

The lesson generalises. Before proposing a type to hold an invariant, ask what its zero value
does, and whether the property is already held by construction somewhere the change would
disturb. A universal wrapper's reach is proved by driving a path that matches **no** route, which
needs no enumeration and no production change.

## A decision the next change would re-litigate gets a record

`{decisions-dir}` is the only artifact that outlives its change. The tests pin what the code does,
`{invariants-index}` names what enforces a universal claim, and a change directory keeps what one
change intended — and **none of them holds a rejected alternative**. That is the thing a later
reader re-opens, because the code shows only the branch that was taken.

Where `PROJECT.md` declares no `{decisions-dir}`, say so explicitly and put the decision in
`design.md` — an unstated answer is indistinguishable from a forgotten one.

**Three tests, applied to what the change decided rather than to the size of its diff. Any one of
them means a record.**

1. **It constrains a change nobody has proposed yet.** A key encoding every later store change
   must key by; where a configuration override is allowed to live. A decision whose reach stops at
   this change's own code is a `design.md` decision, not this.
2. **Its evidence is an absence.** A refusal, a thing deliberately not built, an alternative
   measured and rejected. A test can pin that the thing is absent, but it cannot say why the
   alternative lost — so the absence survives and its reason does not. That asymmetry is what a
   decision record is for.
3. **It reverses or narrows something already recorded.** Then the record is the amendment, below.

**What needs no record**: a token *value*; a mechanism whose reach ends at this change; a decision
that restates one already recorded. Volume is not the trigger and never has been — a one-line diff
that abandons a recorded direction needs a record, and a thousand-line diff that follows one does
not.

**Amendment is the half that gets missed**, because it is work on a file the change is not
otherwise touching. The trigger is mechanical: **the change makes a sentence in an accepted record
false.** Then that record is marked as follows:

- status becomes `Accepted (amended)`;
- an **amendment block** directly under Status names each amending record and what it changes;
- the row in `{decisions-index}` is updated to match.

Full supersession is for a record whose decision is wholly replaced — status
`Superseded by <the successor>`, with the successor declaring `Supersedes <the original>`.
Amendment exists because supersession would wrongly invalidate the parts still standing.

Both directions are load-bearing: a record that declares in its own Status that it *Amends*,
*Narrows* or *Extends* an accepted record must be acknowledged by a backlink in that record's
Status, and a record left silent about its own amendment is the fault this rule names. Nothing
checks any of it, so the commit that adds or amends a record carries its index row in the same
commit, or the index is wrong from that moment.

**Where the obligation is discharged**, since a decision can surface at any point:

| Step | What it owes |
|---|---|
| `/wf-propose` | a task in the group whose work makes the decision |
| `/wf-review-proposal` | catch a decision the proposal makes and does not record |
| `/wf-implement` | a decision that surfaced during apply — append the task, or escalate if it changes direction |
| `/wf-review` | may mark a record the shipped change contradicted; may **not** author a new one |
| `/wf-archive` | the last point the change's context is still in hand |

Three measurements say why this is written down rather than left to judgement. One record was
written *after* its code shipped, as a follow-up to a direct commit, because "a change of
direction gets a record" had no step behind it. Another was not in its proposal at all — a
reviewer's judgement added the task, and nothing would have caught it otherwise. And six changes
each hand-wrote "add its row to the index" as a task, the last five of them consecutively, which
is a standing obligation being rediscovered every time.

## Durable artifacts cite symbols, not lines

`proposal.md`, `design.md` and `tasks.md` cite a **symbol** — a function, type, test or
requirement name. Never `file:line`. A line number is wrong the moment anything above it moves,
and a reviewer told to verify claims will find it and raise it as a finding, so every citation is
a scheduled drift report. `review.md` may cite lines: it is a dated record of one reading, not a
live claim.

One change carried **305** line citations across its artifacts, and every one of them was a drift
finding waiting to be raised.

## A review reviews code, never the review record

`review.md` is a dated record of a past reading. It is **never** a source of findings — not its
own round's, not a previous one's. A review reads it for two things only: the review number, and
which `R(N-1).X` items to judge. Auditing it for staleness, a drifted line number or a renamed
test is how a review starts reviewing itself. The same applies to narration in `tasks.md`, which
this file already forbids existing.

Reviewing prose produces prose findings, whose fixes are more prose, which the next round then
verifies. Seven of the eight findings across one change's rounds 2–4 were prose-versus-code
mismatches; not one was a service defect.

**A review is as short as its findings allow.** Artifact volume predicts review rounds almost
exactly: 472 lines → 1 round, 1,365 → 1, 2,267 → 2, 3,240 → 3, 3,881 → 4. State each finding
once, at the length its severity earns — evidence and a reproduction for a behavioural one, a
single line for documentation debt. Do not inventory what is correct and do not praise. If a
`## Review N` section runs longer than the change's `design.md`, it is narrating rather than
reviewing. The worst instance reached 1,561 lines and 16,330 words to yield 69 task entries
against 2,990 lines of production code, every finding written twice at near-full length — once as
prose and again in its task.

## Meta-work is capped at one change in flight

A change is **meta-work** if it delivers no behaviour a user of the service can observe: build
tooling, task-runner targets, linter configuration. At most one may be active at a time, and its
proposal must open with the business cost it removes.

The workflow's own files are **not** in this category — they are a direct commit, per "The
workflow is edited directly" below.

**A review may not create meta-work.** It records a finding; turning that finding into a change is
a decision for the person who owns the schedule.

The reason is measured. A run of meta changes, each created by review findings rather than by a
product need and each then reviewed, produced more of themselves and went four and three review
rounds.

Weigh meta-work against the project's own standing gap — the thing it exists to do that it does
not yet do. `{project-rules}` is where a project names that gap, if it has one.

**Split a change when its production diff is incidental to its purpose.** One change carried two
error-wrapping lines in two production files; those few production lines dragged thousands of lines
of tooling and artifacts through the full behavioural review protocol.
