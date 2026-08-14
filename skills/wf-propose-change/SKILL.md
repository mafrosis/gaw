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

A change lives in `changes/<name>/` and holds exactly three artifacts:

| Artifact | Answers |
|---|---|
| `proposal.md` | **why**, and what changes |
| `design.md` | **how** — decisions, alternatives, risks |
| `tasks.md` | the ordered checklist that `/wf-implement` works through |

There is no spec artifact. The workflow keeps no spec corpus: behaviour is described by tests, which
cannot go stale because they fail, and decisions live in the project's decision records, which are
dated and allowed to age. A proposal that wants to state a behavioural contract states it as a task
that writes a failing test.

**Input**: a change name (kebab-case), or a description to derive one from.

## Steps

1. **Establish what is being built.** If the input is not clear, ask — do not proceed on a
   guess. Derive a kebab-case name from the answer (e.g. "add user authentication" →
   `add-user-auth`).

2. **Check the name is free.** If `changes/<name>/` already exists, ask whether to continue
   that change or pick another name.

3. **Read the ground truth before writing.** The project's own standards, the relevant records in
   the project's decision records, and the code the change will touch. A proposal written without
   reading the code is where scope errors come from.

4. **Create the directory and write the artifacts in order**, using the TodoWrite tool to
   track them. Each builds on the last, so write them in sequence and read what you wrote.

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
   - **Risks / Trade-offs**: `[risk] → mitigation`.
   - **Migration Plan**: deployment order and rollback, when either is non-trivial.
   - **Open Questions**: only genuinely deferrable unknowns. A question that would change
     the approach or the task list is not deferrable — resolve it with the user now.

   **`tasks.md`** — the checklist. Format matters: `changestat` counts checkboxes.
   - Group under `## N.` headings; one commit per group at apply time.
   - Every task is `- [ ] N.X <description>`. A task not written as a checkbox is not tracked.
   - Order by dependency, and prefer test-first: a failing test, then the code, then the gate
     closing each group.
   - Each task must be verifiable — you can tell when it is done.

5. **Report status** with `changestat` and confirm all three artifacts exist.

6. **Commit** — per the Propose checkpoint:
   ```bash
   git add changes/<name>
   git commit -m "docs(changes): propose <name>"
   ```

## Guardrails

- Write all three artifacts, in order, reading each before writing the next.
- Prefer a decision over a question, but ask when the answer would change the task list.
- Do not invent scope. A task nobody asked for is the fault `/wf-review-proposal` exists
  to catch.
- Durable artifacts cite **symbols**, never `file:line` — a line number is a scheduled drift report.
- Record architectural decisions where the project keeps them, not in the change. A change's design
  is how *this* change works; an ADR is a decision the repository keeps.
