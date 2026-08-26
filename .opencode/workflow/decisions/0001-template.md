# 1. Record architecture decisions

Date: YYYY-MM-DD

## Status

Accepted

<!--
Where a later record changes only part of this one, this block becomes:

    Accepted (amended)

    **Amended by:**
    - ADR-NNNN — <what it changes>

A record wholly replaced instead reads `Superseded by ADR-NNNN`, and the successor declares
`Supersedes ADR-MMMM`. The rules are in `.opencode/workflow/POLICY.md`.
-->

## Context

The significant architectural decisions made on a project need to be recorded so that current and
future contributors understand *why* the system is built the way it is. Without a durable record,
the rationale behind choices is lost, decisions get silently re-litigated, and onboarding is
slower.

The tests pin what the code does. The change directory keeps what one change intended. Neither
holds a **rejected alternative**, and that is the thing a later reader re-opens — because the code
shows only the branch that was taken.

## Decision

We will use Architecture Decision Records, as described by Michael Nygard, to capture
architecturally significant decisions.

- Records live in this directory as Markdown files named `NNNN-short-title.md`.
- Each uses the sections: Status, Context, Decision, and Consequences.
- A record is immutable once accepted; a later decision that changes it is written as a new record
  that supersedes the earlier one, or — where only part of it changes — as an amendment marked in
  the accepted record's Status block.
- Before acceptance a record may be revised in place.
- Every record carries its index row in the same commit.

**Which decisions are owed a record is not a judgement call**: `.opencode/workflow/POLICY.md` holds
three tests, and any one of them means a record. The design rationale for a specific change may
also live in that change's `design.md`; a record is the long-lived, repo-level statement that
outlives any single change.

## Consequences

- Contributors gain a browsable history of decisions and their motivations.
- Every significant decision costs a small amount of writing effort, which is an acceptable trade
  for the durability and clarity it provides.
- A rejected alternative has somewhere to live, so the next change does not re-measure it.

See Michael Nygard's article, "Documenting Architecture Decisions", for the original description of
this technique.
