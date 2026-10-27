# Invariants

Claims quantified over a set the code can enumerate — "every write validates its identifier",
"every route requires identity" — and the artefact that enforces each.

A row asserts "claim X is enforced by Y". Whether Y exists is checkable by a program, which is
what keeps this index honest; `{invariants}` in `.opencode/workflow/PROJECT.md` names the check,
where the project has one.

Prefer an artefact that makes the violation unrepresentable (a type, a wrapper every request
passes through). Otherwise cite a test that derives its own scope — one that enumerates the set
rather than listing members — so a member added later cannot escape it.

| Invariant | Enforced by | Kind |
|---|---|---|
| | | |

`Kind` is `construction` (unrepresentable) or `test` (a test that enumerates the set).
