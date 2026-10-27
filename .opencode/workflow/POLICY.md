# Workflow policy

The rules of the change workflow itself. This file is **project-neutral**: it is part of the
`.opencode/` bundle and moves with it. Everything that varies between projects — the gate
commands, which directories hold production code, where decision records live — is declared in
`PROJECT.md` beside this file.

Read this with `PROJECT.md`. Neither is complete alone.

## How to read a slot

A name in braces is a **slot**, resolved through `PROJECT.md`:

- `{format}` `{lint}` `{test}` — the three required commands.
- `{gate}` — shorthand for `{format}` then `{lint}` then `{test}`, plus every row of
  `PROJECT.md`'s "Conditional gates" table whose surface the change touches.
- `{production-roots}` `{test-patterns}` — path sets, not commands.

**A slot `PROJECT.md` leaves empty or `none` is skipped, and the step that wanted it says so.**
An unrun check and a passing one must never read alike.

## What is fixed, and not a slot

These are properties of the workflow, so a project does not get to configure them:

| Fixed | What it is |
|---|---|
| `changes/<name>/` | where a change lives |
| `proposal.md` `design.md` `tasks.md` | the three artifacts every change holds |
| `report.md` | the compounding status report, rewritten by every stage |
| `review.md` `test_plan.md` | added once those steps have run |
| `changes/archive/YYYY-MM-DD-<name>/` | where an archived change lands |
| `- [ ] N.X` / `- [ ] RN.X` | the task and review-fix checkbox forms the counter and the plugin both parse |
| `bun .opencode/workflow/changestat.ts [-change <name>] [-verify]` | the task counter: progress per change; `-verify` exits 2 while tasks remain, 1 when it cannot look |
| `cd .opencode && bun test tests/` | the bundle's own tests — the gate for a workflow edit |
| `wf-flow` · `wf-stage` | the orchestrator skill and the subagent each stage runs in |

## Bootstrap

Every skill checks this before its first step. It is the only place the bundle creates files of
its own, so a fresh project needs nothing but the copied `.opencode/` directory.

### `PROJECT.md`

Run this when `.opencode/workflow/PROJECT.md` is **missing**, or **stale** — any path its
`{production-roots}` names does not exist here, which means it was copied from another project.

1. Say which it is, and that bootstrap runs before the step that was asked for.
2. Read how the project builds and tests itself: a Makefile or justfile, the scripts in
   package.json, go.mod, pyproject.toml, Cargo.toml, the CI configuration, the README, and the
   directory layout.
3. Propose a value for every slot in `.opencode/workflow/PROJECT.template.md`. Prefer the
   project's own entry point (a task-runner target over the command it wraps). Never invent a
   command the project does not have; an optional slot with nothing to point at stays empty.
4. Confirm with the **question** tool: one question for each required slot whose value is
   uncertain, and the rest as one list to accept or amend.
5. Write `PROJECT.md` from the template with the confirmed values. A required slot the project
   has no command for is `none`, which every step reports as skipped.
6. Check that each command's entry point exists — the target is in the Makefile, the script is
   in package.json. Do not run the suites.
7. Commit it alone, by explicit path: `docs(wf): bootstrap PROJECT.md`. Then carry on with the
   step that was asked for.

`/wf-explore` is read-only: it reports a missing or stale `PROJECT.md`, offers to bootstrap, and
otherwise carries on without slots.

### Everything else is created on first use

| What | Absent means | Created by |
|---|---|---|
| `changes/` | no active changes | `/wf-propose`, when it writes the first change |
| `changes/archive/` | nothing archived yet | `/wf-archive`, when it archives the first change |
| `{decisions-dir}` (declared) | no records yet | the first task that writes a record: copy `.opencode/workflow/decisions/README.template.md` to `{decisions-index}` and `.opencode/workflow/decisions/0001-template.md` to `0001-record-architecture-decisions.md` in that directory, fill in the date, and delete the template's "Copied from" note |
| `{invariants-index}` (declared) | no invariants recorded yet | the first task that adds a row: copy `.opencode/workflow/invariants.template.md` |

A slot left empty creates nothing. With no `{decisions-dir}`, a durable decision is written into
the change's `design.md` (see "A decision the next change would re-litigate gets a record"); with
no `{invariants}`, say that the index rows were not checked mechanically.

## The pipeline

```
 /wf-explore ─▶ explore        a conversation: offers to propose, never continues by itself

 /wf-propose ─▶ propose
                   │
                   ▼
                review-proposal ◀──────────── update ◀─ /wf-update
                   │  ├─ Rework ────────────────────────────────▶ STOP: decide the objective
                   │  └─ Precondition ──────────────────────────▶ STOP: parked
                   │ Sound / Refine
                   ▼
        ┌──────▶ implement
        │          │  └─ unclear task · design issue · blocker ──▶ STOP
        │          │ every task ticked; the review recommendation sets the review's scope
        │          ▼
        │        review
        │          │  └─ route C · scope cap · mostly review-derived
        │          │     · round 3 or later still blocking ─────▶ STOP
        └── RN.X ──┤
          route B  │ Approved / Approved with fixes applied
          only     ▼
                 archive ── no review.md, code changed ─▶ review
                   │  └─ incomplete tasks · a record owed ──────▶ STOP: confirm
                   ▼
                 DONE
```

Any stage may also stop with a question it cannot resolve itself — a "needs input" stop. Answering
it resumes the same stage, and the flow carries on from there.

A change lives in `changes/<name>/` and holds three artifacts — `proposal.md` (why), `design.md`
(how), `tasks.md` (the ordered checklist) — plus `report.md` from its first stage, and `review.md`
and `test_plan.md` once those steps have run.

**There is no spec artifact.** See "Behaviour is described by tests" below.

### The flow continues until a human is needed

Every `/wf-*` command except `/wf-explore` runs the `wf-flow` skill, starting at that command's
stage. It runs each stage, reads the stage's hand-off, and **starts the next stage without
asking** — the commits are checkpoints, not pauses. It stops only on one of these:

| Stop | When |
|---|---|
| **needs input** | a stage has a question only the user can answer: an ambiguous request, a finding whose resolution would change the objective, a route-C review finding, an archive warning to confirm |
| **parked** | the plan is right and cannot start: `Precondition:` is not `none` |
| **blocked** | an error or a red gate the stage could not fix within its own rules |
| **loop guard** | a review round 3 or later returns `Changes required`; an unattended run hands that decision to a human rather than starting another round |
| **bound** | the user asked for the run to stop at a stage ("propose only", "up to implement") |
| **done** | the change is archived |

A stop that is none of these is a fault in the stage. In particular, finishing a stage is not a
reason to stop, a passing commit is not a reason to stop, and neither is the length of the run.

| From | Outcome | Next |
|---|---|---|
| propose | artifacts written | review-proposal |
| review-proposal | `Sound` or `Refine`, `Precondition: none` | implement |
| review-proposal | scoped to one group after an escalation | implement |
| implement | every task ticked | review, at the scope the recommendation names: full, a named surface, or the named targeted check |
| review | `Approved`, or `Approved with fixes applied` | archive |
| review | `Changes required`, every open finding a route-B task | implement |
| archive | no `review.md` and the change touched code | review |
| archive | moved and committed | done |
| update | a design revised after an escalation | review-proposal, scoped to the affected group |
| update | anything else | the stage `report.md` names as next |

### Stages run in isolated contexts

`wf-flow` is a thin orchestrator. It runs each stage in a **fresh subagent** — the `wf-stage`
agent in `.opencode/agents/wf-stage.md` — so the code one stage read does not crowd the next
stage's reasoning, and so the orchestrator's own context holds only hand-offs and reports. The
orchestrator reads `report.md` and the hand-off; it does not read code.

A stage running as a subagent **never asks the user directly**: the `wf-stage` agent has no
question tool. Wherever a skill says to ask, the stage instead ends with a hand-off whose `stop` is
`needs-input`, carrying the questions; the orchestrator asks them and resumes the same subagent with
the answers. Inside a stage, prefer a further subagent (`explore` for reading, `general` for an
independent check) for any wide search or second opinion whose detail the stage does not need to
keep.

Where `wf-stage` is not installed, `general` runs the stages instead — except `implement`, which
needs `todowrite` and so runs in the orchestrator's own session.

### The hand-off

Every stage ends by writing `report.md` (below), committing per its checkpoint, and returning
exactly this block as its final message:

```
WF-HANDOFF
change: <name>
stage: <the stage just run>
outcome: <verdict or result, a few words>
next: <propose | review-proposal | implement | review | archive | update | done>
next-scope: <whole | task group N | surface <what> | targeted: <the check> | none>
stop: <none | needs-input | parked | blocked | done>
questions: <numbered, only when stop is needs-input: each with its options and a recommendation>
commit: <short sha, or none>
```

A skill loaded directly in the main session, outside `wf-flow`, writes the same report and then
loads `wf-flow` to continue from `next`, rather than ending its turn.

## The report

`changes/<name>/report.md` is the **one file a human reads** to know where a change stands and
why. Every stage rewrites it in full from the previous version, so it compounds: the newest one
carries every decision and trade-off made so far, and nothing older needs reading. Its shape is
`.opencode/workflow/report.template.md`; the first stage to run creates it from that template.

- **Cumulative sections** — "Where it stands", "Decisions and trade-offs", "Log" — are carried
  forward and extended. A decision a later stage reversed is struck through and the reversal
  added, not deleted.
- **"Latest stage"** is replaced each time with that stage's own summary block.
- **"Waiting on you"** is non-empty exactly when the flow stopped, and says what would let it
  continue.
- One line per decision, per log row and per open question. The report points at `design.md`,
  `review.md` and the decision records; it does not restate them.

`report.md` is staged with the stage's own checkpoint commit — every stage changes it, so every
stage commits. It is a rolling status record like `review.md`: it cites symbols rather than lines,
and it is **never a source of review findings**.

## Git commit policy

Commits are made **automatically** at the checkpoints below. This is a standing instruction — do
not ask for per-commit confirmation at these points, and do not stop after one. Every checkpoint
commit also stages `changes/<change-name>/report.md`.

### Checkpoints

1. **Propose** — after `/wf-propose` creates or updates a change's artifacts and they are
   coherent, commit them in a single commit:
   - Message: `docs(changes): propose <change-name>`
   - Scope: `changes/<change-name>/` (proposal.md, design.md, tasks.md)

2. **Review Proposal** — after `/wf-review-proposal` critiques a change and revises its proposal
   artifacts, commit them:
   - Message: `docs(changes): review-proposal <change-name>`
   - Scope: `changes/<change-name>/` (proposal.md, design.md, tasks.md)
   - A review that changed no artifact still commits, because it updated `report.md`.

3. **Apply** — during `/wf-implement`, commit once per task group (each `## N` heading in
   `tasks.md`), bundling that group's code changes with its `- [x]` checkbox updates:
   - Message: `<type>(<scope>): <group summary> [<change-name>]`
   - `<type>` is one of `feat` `fix` `refactor` `test` `docs` `build` `chore`
   - Commit only after the group's work satisfies its tasks — it builds and `{gate}` passes.
   - At the end of an apply session, write or merge `changes/<change-name>/test_plan.md`, update
     `report.md`, and **stage both with that session's last task-group commit**, never as a commit
     of their own. If the session paused mid-group with no group commit to attach to, they wait for
     the next one.

4. **Review** — after `/wf-review` writes findings, closes the trivial ones and records the rest
   as tasks, commit all of it **together**:
   - Message: `docs(changes): review <change-name> (review N)`
   - Scope: `changes/<change-name>/review.md`, `tasks.md` (the `Review N Findings` section), and
     the test or documentation files the round fixed in place
   - **One commit per round**, so a round's record is never split across two.

5. **Archive** — after `/wf-archive` moves the change to `archive/`, commit the result:
   - Message: `chore(changes): archive <change-name>`
   - Archiving is a `git mv` into `changes/archive/YYYY-MM-DD-<change-name>/`; nothing is merged
     anywhere.

6. **Update** (ad hoc — not part of the linear pipeline) — after `/wf-update` revises a change's
   planning artifacts and leaves them coherent, commit the revised files:
   - Message: `docs(changes): update <change-name>`
   - Scope: the revised artifacts under `changes/<change-name>/`
   - Skip the commit if no edits were made, or if `/wf-update` was invoked as a delegated sub-step
     of another checkpoint that owns the commit (e.g. a reconciliation handed to it by Review
     Proposal).

### Rules

- Auto-commit at the checkpoints above; keep the working tree clean between them.
- One logical change per commit. Stage explicit paths — never `git add -A` blindly.
- Run `{gate}` before committing, and do not commit until it passes. **`{lint}` is not optional**
  where `PROJECT.md` declares one. A finding that is a deliberate choice is exempted at that line
  with the language's own suppression comment and a reason — never by broadening the linter's
  global configuration, which silences the next instance too.
- Never commit secrets, credentials, or build output.
- Never `git push`, force-push, amend already-published commits, or open PRs unless explicitly
  requested.
- If a commit or a hook fails, fix forward with a new commit — do not amend the failed one.

## Some classes of change are a direct commit

A class of change whose rigour is **already mechanised** is a direct commit: no change directory,
no proposal, no review round, no archive. A class qualifies only when all four hold:

1. **The failure a human reliably misses is already caught mechanically** — the specific mistake
   this class of change makes, caught by something that runs every time.
2. **A regression fails the build, not a review.** Where the checking is a person reading, the
   class does not qualify.
3. **A change in this class cannot break a test spuriously.** If it can, every change in it needs
   a reader anyway.
4. **What is left for a review round is something a review round does not catch** — whether a
   result looks good, or a sentence reads well.

Since nothing in the class can trip a test spuriously, a test that *does* fail is a signal to
**leave the class** — never to relax the test. The thing being changed is a contract, and the
reasoning is in the test beside it.

**Every class names its escalations**: the work its mechanised checks do *not* cover, typically
anything that adds behaviour rather than adjusting the expression of behaviour already there. A
class with no named escalations is an exemption, not a class.

**A change of direction still gets a record, regardless of diff size.** See "A decision the next
change would re-litigate gets a record" below.

**Where a project declares its own classes:** `{project-rules}`. This workflow declares one for
itself, below.

## The workflow is edited directly, never proposed

**A change to the workflow itself is a direct commit.** No change directory, no proposal, no
review round, no archive.

| | |
|---|---|
| **Scope** | a `wf-*` skill, a `wf-*` command, `wf-stage.md`, anything under `.opencode/workflow/`, `tasks-todo-sync.ts`, the bundle's tests |
| **Message** | `docs(wf): <what>` for prose, `fix(wf): <what>` or `refactor(wf): <what>` for the executable parts |
| **Gate** | the bundle's tests (`cd .opencode && bun test tests/`) green, explicit paths staged |

It qualifies on the four criteria above. The bundle's tests cover its executable parts — the task
counter, the checkbox parser, the todo-sync plugin — and `.opencode/tests/self-contained.test.ts`
fails when a skill cites a command, slot or path the bundle does not carry, which is the mistake
this class of change makes. What is left is prose, and a review round applied to prose produces
prose findings; a review round reviewing a change to the review step is also circular.

### Three things this does not license

1. **A change to the project's own tooling is still capped meta-work.** Build tooling,
   task-runner targets, linter configuration — those are project code that the workflow happens to
   call. See "Meta-work is capped at one change in flight" below.
2. **A change of workflow *direction* still owes a decision record**, on the same three tests as
   anything else. Removing a step, changing what artifacts a change holds, abandoning the mirror
   between `tasks.md` and the todo list — each is a direct commit's worth of diff and a record's
   worth of decision.
3. **An edit to the executable parts is held to the standard any code is.** A guard added to the
   plugin or the counter needs a test that fails without it, with the mutation recorded in a
   comment on the test. Direct commit means no review *round*; it does not mean no evidence.

### What this means for the steps

- **`/wf-propose`** — refuse. A request to change a skill, a command, `POLICY.md` or `PROJECT.md`
  is not a change to propose; say so and edit the file.
- **`/wf-review`** — a finding that the workflow itself should change is reported and then applied
  directly, not turned into an `RN.X` task and not turned into a new change.
- **`/wf-update`** and **`/wf-archive`** — a workflow edit never reaches either; there is no change
  directory to update or archive.

## The proposal is corrected before apply, not after

`/wf-review-proposal` **rewrites** the change's artifacts. Nothing is built yet, so a task added or
a design reworked costs only the edit. It edits `proposal.md`, `design.md` and `tasks.md` directly,
and asks the user only when a finding is genuinely ambiguous or when closing it would change the
change's **objective** rather than complete it. A proposal review that finds a gap and declines to
close it has moved the gap into apply, where it is expensive.

**Scope is the objective, not the task count.** Adding tasks because the stated objective cannot be
met without them is the step working. Adding a task that pursues a *new* objective is scope creep,
and that is what `Rework` is for.

**A verdict judges the plan; the schedule is a separate, recorded fact.** A plan whose only
obstacle is outside it — another change holds a file it needs, a decision is pending elsewhere — is
`Refine`, its findings closed now, with a `Precondition:` recorded in its own `proposal.md`, because
`/wf-implement` reads the artifact and not the chat. **Parking never defers a finding**: the
corrections are cheapest while the reading of the code is fresh.

`/wf-review` is the mirror image. Once code exists, the review's write scope is `review.md`, the
`RN.X` lines in `tasks.md`, and the **test or documentation files a trivial finding is closed
by** — a stale comment, a missing test case, a vacuous assertion, an accepted record the change
contradicted. It never changes production behaviour: nothing under `{production-roots}` except a
file matching `{test-patterns}`, because that fix belongs to `/wf-implement` where the evidence
gate lives. It never edits `proposal.md` or `design.md`, and it never writes a *new* decision
record. A `design` finding is escalated — `/wf-update` to revise the artifacts, then
`/wf-review-proposal` to review the revision — because the workflow's only design gate sits
pre-apply, so a mechanism written into `design.md` by a post-apply review is unreviewed design.

Three kinds of finding reach the user for a decision: one whose resolution may need the plan
changed, one saying the plan itself is wrong, and one naming a durable decision the change made
that no record holds. A bug is a task without asking; a stale sentence is fixed without asking, and
so is marking a record the change contradicted.

## A review fix is held to the standard its finding was raised under

A task group containing `RN.X` review-fix tasks is committable only when all four hold. **So is a
fix `/wf-review` made in place** — the standard is a property of the finding, not of the command
that closed it.

1. **Every guard the fix added has a test confirmed to fail without it** — removed or inverted,
   the suite run, seen red, restored. Record the mutation in **a comment on the test**:
   `Fails without the <X> guard: <mutation>`, where it is read when the test is next edited.
2. **`{coverage}`, then `{coverage-gaps}` for each package or module the fix touched**, one
   invocation each. Assert it in the commit message: `Coverage-checked: <the units>`. Run
   `{coverage}` first — `{coverage-gaps}` reads a profile nothing else regenerates, so a stale
   profile satisfies the condition silently. Where `PROJECT.md` declares neither, say the check was
   unavailable rather than passing over it.
3. **`{gate}` passes**, including every conditional gate for the surface touched.
4. **The fix does only what its finding asked.** A fix that adds a mechanism, changes an
   interface, or refactors across module boundaries is new scope wearing a fix's clothes —
   escalate it via `/wf-update` + `/wf-review-proposal` instead.

**A `tasks.md` entry for a review fix is one line**: `- [x] RN.X <what was done>`. Evidence lives
in the code, the test comment and the commit message — never narrated into the artifact, where the
next review round would audit it.

**A review does not author designs.** A mechanism authored in a review fix enters the tree at the
one point with no design review. A finding may say a design is wrong; the replacement goes through
`/wf-update` + `/wf-review-proposal`.

A `design` finding whose recommended resolution changes no executable behaviour is not a design
finding: it is a `docs` finding and costs one `RN.X` line. Tag by the resolution recommended, not
by the most expensive one available — a finding offering a choice between narrowing prose and
adding a mechanism is `docs` when the prose is what you recommend, and the user choosing the
mechanism is what escalates. A later review may downgrade a prior escalation on that test, never
upgrade one.

**A fix that cannot be implemented as written is not approximated.** Say so, record the deviation
with its evidence in the `Deviations from review N's recommendations` section of `tasks.md`, and
implement what the finding was protecting. A review's model of the code is sometimes wrong.

## Review-derived work and the provenance gate

Work is **review-derived** if its task group is not traceable to `proposal.md`'s *What Changes* —
it exists because a review asked for it. Read the proposal against `tasks.md`; this needs no
tooling.

- A finding against review-derived work may **not** be `Blocking` unless it names a defect
  **observable by a user of the software**. Otherwise it is documentation debt — or the work itself
  is dropped, because no proposal asked for it.
- When most of a round's findings are review-derived, **that is the headline finding**: the change's
  own scope is finished and the review is reviewing its own accumulation. Recommend closing the
  change rather than fixing the tail.
- This is the termination condition, and it is why there is no cap on review rounds: a round limit
  is arbitrary, provenance is not.
- A session whose work was `RN.X` fixes produces review-derived work by definition, so a following
  round on it can block only on a user-observable defect.

## Behaviour is described by tests

There is no spec corpus and no spec artifact in a change. A document that must be verified
before it can be trusted costs the verification and can still mislead; a test fails when it goes
stale.

- **behaviour** → the tests. A behaviour worth keeping is worth a test that fails without it; "it
  works" is not evidence, "it fails when broken" is.
- **which invariants are universal, and what enforces each** → `{invariants-index}`, checked by
  `{invariants}`, where `PROJECT.md` declares them. A row asserts "claim X is enforced by artefact
  Y", and whether Y exists is decidable by a program — which is what distinguishes an index from a
  spec. An index nothing checks does not earn that distinction.
- **decisions and their rationale** → `{decisions-dir}`. Dated, and explicitly allowed to age, so
  a record is never wrong — only historical.
- **what a change intended** → its own `changes/archive/<date>-<name>/` directory, beside the code
  and the log it produced.

For an invariant that is *universal* — "every write validates its identifier", "every route
requires identity" — a hand-written test asserts one case and says nothing about the set. So:

1. **Prefer making it unrepresentable.** A field that does not exist, or a wrapper applied at a
   point every request passes through, cannot be got wrong. A type with no field for per-field
   state makes "this thing is never editable" a property of the type rather than a rule.
2. **Otherwise write a test that derives its own scope** — reflect over the interface, walk the
   command tree, scan the AST — so a member added later cannot escape it.

**Check that option 1 really is option 1.** Before proposing a type to hold an invariant, ask what
its zero value does: a validating newtype whose zero value is still expressible needs the
implementations to keep refusing it, and a newtype over a string accepts any conversion. And ask
whether the property is already held by construction somewhere the change would disturb: a
per-item flag added to a set that a shared wrapper already covers makes the violation representable
for the first time. A universal wrapper's reach is proved by driving a path that matches **no**
member, which needs no enumeration.

## A decision the next change would re-litigate gets a record

`{decisions-dir}` is the only artifact that outlives its change. The tests pin what the code does,
`{invariants-index}` names what enforces a universal claim, and a change directory keeps what one
change intended — and **none of them holds a rejected alternative**. That is what a later reader
re-opens, because the code shows only the branch that was taken.

Where `PROJECT.md` declares no `{decisions-dir}`, say so explicitly and put the decision in
`design.md` — an unstated answer is indistinguishable from a forgotten one. Where it declares one
that does not exist yet, the first record creates it (see "Bootstrap").

**Three tests, applied to what the change decided rather than to the size of its diff. Any one of
them means a record.**

1. **It constrains a change nobody has proposed yet.** A key encoding every later storage change
   must follow; where a configuration override is allowed to live. A decision whose reach stops at
   this change's own code is a `design.md` decision.
2. **Its evidence is an absence.** A refusal, a thing deliberately not built, an alternative
   measured and rejected. A test can pin that the thing is absent, but not why the alternative
   lost.
3. **It reverses or narrows something already recorded.** Then the record is the amendment, below.

**What needs no record**: a token *value*; a mechanism whose reach ends at this change; a decision
that restates one already recorded. Volume is not the trigger — a one-line diff that abandons a
recorded direction needs a record, and a thousand-line diff that follows one does not.

**Amendment is the half that gets missed**, because it is work on a file the change is not
otherwise touching. The trigger is mechanical: **the change makes a sentence in an accepted record
false.** Then that record is marked as follows:

- status becomes `Accepted (amended)`;
- an **amendment block** directly under Status names each amending record and what it changes;
- the row in `{decisions-index}` is updated to match.

Full supersession is for a record whose decision is wholly replaced — status
`Superseded by <the successor>`, with the successor declaring `Supersedes <the original>`.
Amendment exists because supersession would wrongly invalidate the parts still standing.

Both directions are required: a record that declares in its own Status that it *Amends*, *Narrows*
or *Extends* an accepted record must be acknowledged by a backlink in that record's Status. Nothing
checks any of it, so the commit that adds or amends a record carries its index row in the same
commit.

**Where the obligation is discharged**, since a decision can surface at any point:

| Step | What it owes |
|---|---|
| `/wf-propose` | a task in the group whose work makes the decision |
| `/wf-review-proposal` | catch a decision the proposal makes and does not record |
| `/wf-implement` | a decision that surfaced during apply — append the task, or escalate if it changes direction |
| `/wf-review` | may mark a record the shipped change contradicted; may **not** author a new one |
| `/wf-archive` | the last point the change's context is still in hand |

### Which records a design must account for

"The relevant records" is not a judgement about titles. **It is derivable from the design's own
text:**

> A design must **account for every record in `{decisions-dir}` that mentions a symbol the design
> names** — cited, amended, or explicitly listed as checked and not owed.

Any of the three discharges it; silence does not. A record's title often names none of the
subjects it constrains, so search the records for each symbol the design names rather than reading
by title. The rule does not ask for a record to be obeyed, only accounted for — "checked and not
owed" is a complete answer — and it says nothing about records a design names no symbol from.

## Durable artifacts cite symbols, not lines

`proposal.md`, `design.md` and `tasks.md` cite a **symbol** — a function, type, test or
requirement name. Never `file:line`: a line number is wrong the moment anything above it moves, so
every line citation is a future drift finding. `review.md` may cite lines: it is a dated record of
one reading, not a live claim.

## A review reviews code, never the review record

`review.md` is a dated record of a past reading. It is **never** a source of findings — not its
own round's, not a previous one's. A review reads it for two things only: the review number, and
which `R(N-1).X` items to judge. The same applies to `report.md` and to narration in `tasks.md`,
which this file already forbids. Reviewing prose produces prose findings, whose fixes are more prose, which the
next round then verifies.

**A review is as short as its findings allow.** Artifact volume predicts review rounds: prose makes
claims, and the next round verifies them. State each finding once, at the length its severity
earns — evidence and a reproduction for a behavioural one, a single line for documentation debt.
Do not inventory what is correct and do not praise. If a `## Review N` section runs longer than the
change's `design.md`, it is narrating rather than reviewing.

## Meta-work is capped at one change in flight

A change is **meta-work** if it delivers no behaviour a user of the software can observe: build
tooling, task-runner targets, linter configuration. At most one may be active at a time, and its
proposal must open with the cost it removes. The workflow's own files are **not** in this category
— they are a direct commit, per "The workflow is edited directly, never proposed" above.

**A review may not create meta-work.** It records a finding; turning that finding into a change is
a decision for the person who owns the schedule. Meta-work created by review findings, and then
reviewed, compounds while the project's own output stalls.

Weigh meta-work against the project's own standing gap — the thing it exists to do that it does
not yet do. `{project-rules}` is where a project names that gap, if it has one.

**Split a change when its production diff is incidental to its purpose**, so a small production
fix is not dragged through the review protocol of the tooling around it.
