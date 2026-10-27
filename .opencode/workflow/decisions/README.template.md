# Architecture Decision Records

This directory holds the Architecture Decision Records (ADRs) for this project. An ADR captures a
single significant architectural decision along with its context and consequences, so the
reasoning behind the system's shape stays discoverable as it grows.

We use the lightweight format popularized by Michael Nygard: each record has a **Status**,
**Context**, **Decision**, and **Consequences**.

> Copied from `.opencode/workflow/decisions/README.template.md` by the workflow's bootstrap.
> Delete this note.

## Process

- Add a new record as `NNNN-short-title.md`, where `NNNN` is the next zero-padded sequence number.
- Copy the structure of `0001`, which is the simplest template.
- Set an initial **Status** of `Proposed`, then `Accepted` once agreed.
- A `Proposed` record may be **revised in place**; immutability begins at `Accepted`.
- **Numbers are not reused.** A withdrawn record leaves its number absent, and the absence is
  itself informative.
- An `Accepted` record should not depend on a `Proposed` one for longer than necessary; promote the
  dependency or leave the dependant `Proposed`.
- Keep each record focused on one decision; prefer several small records over one sprawling
  document.

**When a record is owed, when it must be amended, and how the amendment is marked are in
`.opencode/workflow/POLICY.md` — "A decision the next change would re-litigate gets a record".**

## Terminology

A project accumulates words that must mean exactly one thing across every record. Keep them in a
table here, with the meaning and what each is not to be confused with — it is cheaper than
correcting a record that used the wrong one.

| Term | Meaning | Not to be confused with |
|---|---|---|
| | | |

## Index

Every record has a row here, added or updated **in the same commit as the record itself**. Nothing
checks this, so a commit that adds a record without its row leaves the index wrong from that
moment.

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
