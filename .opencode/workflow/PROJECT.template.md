# Project slots

The per-project half of the workflow. `POLICY.md` beside this file holds the rules; this file
says what they resolve to **here**. Copied from `PROJECT.template.md` and filled in per
project.

A slot appears in `POLICY.md` and in the skills as `{name}`. Resolve it from the tables below.

**An empty optional slot is skipped, and the step that wanted it says so** — never silently. An
unrun check and a passing one must not read alike.

## Commands

| Slot | Command here | Required | When |
|---|---|---|---|
| `{format}` | | yes | before every commit |
| `{lint}` | | yes | before every commit |
| `{test}` | | yes | before every commit; the main test suite |
| `{changes}` | | yes | task progress; `CHANGE=<name>` for one, `VERIFY=1` to gate on completeness |
| `{integration-test}` | | no | any change touching the surface it covers |
| `{ui-test}` | | no | any change touching the UI |
| `{coverage}` | | no | before `{coverage-gaps}`, which reads its profile |
| `{coverage-gaps}` | | no | once per touched package or module, separately |
| `{invariants}` | | no | when a universal invariant moved |
| `{workflow-test}` | | no | any change under `.opencode/` |

`{gate}` is `{format}`, then `{lint}`, then `{test}`, plus whichever of
`{integration-test}`, `{ui-test}` and `{workflow-test}` the touched surface calls for.

## Paths

| Slot | Value here | Required | What it is |
|---|---|---|---|
| `{production-roots}` | | yes | a review may not edit these |
| `{test-patterns}` | | yes | the exception to the above |
| `{decisions-dir}` | | no | architecture decision records |
| `{decisions-index}` | | no | the index a new or amended record updates |
| `{invariants-index}` | | no | universal invariants and what enforces each |
| `{operator-docs}` | | no | operator-facing docs a review checks |
| `{project-rules}` | | no | project-specific escalations and the standing gap |

## Notes for this project

Anything a step needs to know that the tables cannot say — a suite that needs a container, a
command that takes an unusual argument, a check that is informational rather than a gate.
