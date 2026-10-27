---
description: Propose a new change and generate all its artifacts in one step. Use when the user wants to describe what they want to build and get a proposal, design and task list ready for implementation.
---
Propose a change: create `changes/<name>/` and write proposal, design and tasks.

The argument after the command is the change name (kebab-case), or a description of
what you want. If it is missing, infer it from the conversation; ask rather than guess.

**Use the skill tool to load `wf-flow`, and run it starting at stage `propose`.** It runs this
stage in its own subagent (the `wf-propose-change` skill), then carries on through the workflow until a human
decision is needed. To run this stage alone, say so in the argument ("only").
