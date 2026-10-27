# Project slots

The per-project half of the workflow. `POLICY.md` beside this file holds the rules; this file
says what they resolve to **here**. Created from `PROJECT.template.md`; see `POLICY.md`'s
"Bootstrap" for how.

A slot appears in `POLICY.md` and in the skills as `{name}`. Resolve it from the tables below.

**An empty or `none` slot is skipped, and the step that wanted it says so** — never silently. An
unrun check and a passing one must not read alike.

## Commands

| Slot | Command here | Required | When |
|---|---|---|---|
| `{format}` | | yes | before every commit; formats the source in place |
| `{lint}` | | yes | before every commit |
| `{test}` | | yes | before every commit; the main test suite |
| `{coverage}` | | no | writes a coverage profile; run before `{coverage-gaps}` |
| `{coverage-gaps}` | | no | lists uncovered lines for one package or module, from `{coverage}`'s profile |
| `{invariants}` | | no | checks that every row in `{invariants-index}` names an artefact that exists |

A required slot the project genuinely has no command for is written `none`, so the step that
wants it reports the skip rather than guessing.

## Conditional gates

Added to `{gate}` for any change touching the surface named. One row per surface; add as many as
the project needs, or leave the table empty.

| Surface | Command | Why separate from `{test}` |
|---|---|---|

`{gate}` here is `{format}`, then `{lint}`, then `{test}`, plus each row above whose surface the
change touches.

## Paths

| Slot | Value here | Required | What it is |
|---|---|---|---|
| `{production-roots}` | | yes | directories holding production code; a review may not edit these |
| `{test-patterns}` | | yes | globs for test files under those roots; the exception to the above |
| `{decisions-dir}` | | no | architecture decision records |
| `{decisions-index}` | | no | the index a new or amended record updates |
| `{invariants-index}` | | no | universal invariants and what enforces each |
| `{operator-docs}` | | no | user- or operator-facing docs a review checks against the code |
| `{project-rules}` | | no | project-specific direct-commit classes, escalations and the standing gap |

## Notes for this project

Anything a step needs to know that the tables cannot say — a suite that needs a container, a
command that takes an unusual argument, a check that is informational rather than a gate.
