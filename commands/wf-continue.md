---
description: Continue a change from wherever its report says it stands, until a human decision is needed.
---
Continue a change through the workflow from its next stage.

The argument after the command is the change name. If it is missing, infer it from the
conversation; ask rather than guess.

**Use the skill tool to load `wf-flow`, and run it starting at stage `continue`.** It reads
`changes/<name>/report.md` for the next stage and carries on until a human decision is needed.
