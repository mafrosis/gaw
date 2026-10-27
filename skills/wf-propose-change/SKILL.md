---
name: wf-propose-change
description: Propose a new change and generate all its artifacts in one step. Use when the user wants to describe what they want to build and get a proposal, design and task list ready for implementation.
license: MIT
metadata:
  author: mafrosis
  derived-from: "OpenSpec, https://github.com/Fission-AI/OpenSpec"
  version: "1.0"
---

Propose a change: create its directory and write all three artifacts.

> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.** POLICY.md
> holds the workflow's rules; PROJECT.md resolves every `{slot}` below into this project's actual
> command or path. **If PROJECT.md is missing, or names paths this project does not have, run POLICY.md's
> "Bootstrap" first.** A slot left empty or `none` is **skipped, and you say it was skipped** — an
> unrun check and a passing one must never read alike.

A change lives in `changes/<name>/` and holds exactly three artifacts:

| Artifact | Answers |
|---|---|
| `proposal.md` | **why**, and what changes |
| `design.md` | **how** — decisions, alternatives, risks |
| `tasks.md` | the ordered checklist that `/wf-implement` works through |

There is no spec artifact — see `POLICY.md`'s "Behaviour is described by tests". A proposal that
wants to state a behavioural contract states it as a task that writes a failing test; a decision
that outlives the change goes in `{decisions-dir}`.

**Input**: a change name (kebab-case), or a description to derive one from.

## Refuse a workflow edit before step 1

If what is being asked for is a change to the **workflow itself** — a `wf-*` skill, a `wf-*`
command, `.opencode/workflow/POLICY.md` or `PROJECT.md`, the task counter, the checkbox parser or
the todo-sync plugin — **do not create a change.** Say so, and make the edit directly with a
`docs(wf):` or `fix(wf):` commit and the workflow's own tests green.

See `POLICY.md`'s "The workflow is edited directly, never proposed". Two things still come here:
a change to the *project's* tooling (capped meta-work), and a change of workflow **direction**
still owes a decision record.

## Steps

1. **Establish what is being built.** If the input is not clear, ask — do not proceed on a
   guess. Derive a kebab-case name from the answer (e.g. "add user authentication" →
   `add-user-auth`).

2. **Check the name is free.** If `changes/<name>/` already exists, ask whether to continue
   that change or pick another name.

3. **Read the ground truth before writing.** `POLICY.md`, the records in `{decisions-dir}` that
   `POLICY.md`'s *"Which records a design must account for"* makes relevant — every one naming a
   symbol the design names — and the code the change will touch. A proposal written without
   reading the code is where scope errors come from.

4. **Create the directory and write the artifacts in order** — `mkdir -p changes/<name>`
   creates `changes/` too on a project's first change — using the TodoWrite tool to track them. Each builds on the last, so write them in sequence and read what you wrote.

   **`proposal.md`** — sections:
   - **Why**: the problem or opportunity, in one or two sentences. Why now?
   - **What Changes**: a bullet list, specific about new behaviour, modifications and
     removals. Mark a breaking change **BREAKING**.
   - **Impact**: affected code, dependencies, operational consequences, and what is
     deliberately out of scope with a note of where it lands instead.

   Keep it to a page or two. Motivation, not mechanism.

   **`design.md`** — write it when any of these apply: the change spans packages, adds a
   dependency, changes a data model, carries security or migration complexity, or has an
   ambiguity worth settling before coding. Sections:
   - **Context**: only the current state needed to explain the approach. Point at the
     proposal for motivation rather than restating it.
   - **Goals / Non-Goals**: design-level boundaries, not a restatement of scope.
   - **Decisions**: each with its rationale and the alternatives considered. Why X over Y.
     A decision whose reach extends past this change belongs in `{decisions-dir}` instead — this is
     where that is noticed, so check each entry against the ADR guardrail below and cite the
     record rather than restating it.
   - **Risks / Trade-offs**: `[risk] → mitigation`.
   - **Migration Plan**: deployment order and rollback, when either is non-trivial.
   - **Open Questions**: only genuinely deferrable unknowns. A question that would change
     the approach or the task list is not deferrable — resolve it with the user now.

   **`tasks.md`** — the checklist. Format matters: `bun .opencode/workflow/changestat.ts` counts the checkboxes.
   - Group under `## N.` headings; one commit per group at apply time.
   - Every task is `- [ ] N.X <description>`. A task not written as a checkbox is not tracked.
   - Order by dependency, and prefer test-first: a failing test, then the code, then
     `{gate}` closing each group.
   - Each task must be verifiable — you can tell when it is done.

5. **Report status** with `bun .opencode/workflow/changestat.ts` and confirm all three artifacts exist.

6. **Commit** — per the Propose checkpoint in `POLICY.md`:
   ```bash
   git add changes/<name>
   git commit -m "docs(changes): propose <name>"
   ```

## Guardrails

- Write all three artifacts, in order, reading each before writing the next.
- Prefer a decision over a question, but ask when the answer would change the task list.
- Do not invent scope. A task nobody asked for is the fault `/wf-review-proposal` exists
  to catch.
- Durable artifacts cite **symbols**, never `file:line` — a line number is a scheduled
  drift report (`POLICY.md`).
- Record architectural decisions in `{decisions-dir}`, not in the change. A change's design is
  how *this* change works; a decision record is one the repository keeps. If `{decisions-dir}` is
  declared but does not exist yet, the task that writes the first record creates it from the
  templates (`POLICY.md`'s "Bootstrap"); if it is empty, durable decisions go in `design.md`.
- **Ask the ADR question explicitly, in both directions, and write the answer as a task.**
  `POLICY.md`'s "A decision the next change would re-litigate gets a record" holds the three
  tests and the amendment trigger; apply them here, because this is the cheapest point at
  which they can be met.
  - **Creating** — does the change decide something that constrains a change nobody has
    proposed yet, or that will be evidenced only by an absence (a refusal, a thing
    deliberately not built, an alternative measured and rejected)? Then a task in the group
    whose work makes that decision writes the record, and a task adds its row to
    `{decisions-index}`.
  - **Contradicting** — step 3 has already resolved which records are relevant. Account for
    every one of them here, name any whose sentences this change makes false, and carry a task to
    mark each per `POLICY.md`: status `Accepted (amended)`, an amendment block naming the amending
    record, and the `{decisions-index}` row. This is the half that gets missed, because it is work
    on a file the change is not otherwise touching.
  - A change that decides nothing durable says so in `design.md` — under Decisions, that its
    decisions are local to this change. An unstated answer is indistinguishable from a
    forgotten one.
- A change that introduces or alters a **universal invariant** — a claim quantified over a
  set the code can enumerate, "every write validates its identifier" — carries a task to add
  or update its row in `{invariants-index}`. `{invariants}` checks the rows
  resolve; nothing checks that a missing row was noticed, which is why it is a task. If the index
  does not exist yet, that task creates it from the template (`POLICY.md`'s "Bootstrap"). Before
  proposing a type to hold the invariant, read `POLICY.md`'s "Check that option 1 really is
  option 1".
