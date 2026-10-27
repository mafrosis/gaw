---
description: Archive a completed change. Use when the user wants to finalize and archive a change after implementation and review are complete.
---
Archive a completed change once its review gate and task completion are satisfied.

The argument after the command is the change name (kebab-case), or a description of
what you want. If it is missing, infer it from the conversation; ask rather than guess.

**Use the skill tool to load `wf-flow`, and run it starting at stage `archive`.** It runs this
stage in its own subagent (the `wf-archive-change` skill), then carries on through the workflow until a human
decision is needed. To run this stage alone, say so in the argument ("only").
