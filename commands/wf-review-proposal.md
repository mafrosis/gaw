---
description: Critically review a change's proposal before implementation (problem-fit, assumptions, task completeness), then correct the proposal artifacts directly. Use after propose and before apply.
---
Critique a change's plan before implementation, and correct its artifacts directly.

The argument after the command is the change name (kebab-case), or a description of
what you want. If it is missing, infer it from the conversation; ask rather than guess.

**Use the skill tool to load `wf-flow`, and run it starting at stage `review-proposal`.** It runs this
stage in its own subagent (the `wf-review-proposal` skill), then carries on through the workflow until a human
decision is needed. To run this stage alone, say so in the argument ("only").
