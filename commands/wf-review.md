---
description: Review the implementation of a change for quality and adherence to what it proposed. Use after apply and before archive to verify implemented code meets the proposal.
---
Review a change's implementation, writing findings to `review.md`.

The argument after the command is the change name (kebab-case), or a description of
what you want. If it is missing, infer it from the conversation; ask rather than guess.

**Use the skill tool to load `wf-flow`, and run it starting at stage `review`.** It runs this
stage in its own subagent (the `wf-review-change` skill), then carries on through the workflow until a human
decision is needed. To run this stage alone, say so in the argument ("only").
