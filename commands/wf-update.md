---
description: Update a change by revising its existing planning artifacts and keeping them coherent with one another. Use when the user wants to revise a change's plan, fold new decisions into it, or reconcile its artifacts after an edit. Never edits code.
---
Revise a change's planning artifacts and keep them coherent.

The argument after the command is the change name (kebab-case), or a description of
what you want. If it is missing, infer it from the conversation; ask rather than guess.

**Use the skill tool to load `wf-flow`, and run it starting at stage `update`.** It runs this
stage in its own subagent (the `wf-update-change` skill), then carries on through the workflow until a human
decision is needed. To run this stage alone, say so in the argument ("only").
