---
description: Propose a new change and generate all its artifacts in one step. Use when the user wants to describe what they want to build and get a proposal, design and task list ready for implementation.
---
Propose a change: create `changes/<name>/` and write proposal, design and tasks.

The argument after the command is the change name (kebab-case), or a description of
what you want. If it is missing, infer it from the conversation; ask rather than guess.

**Use the skill tool to load `wf-propose-change`, then follow it.** That skill is the single
source of truth for this workflow step — this file deliberately carries no copy of it,
because two copies drift and the copy is what gets read.

The skill will send you to `.opencode/workflow/POLICY.md` for the workflow's rules and
`.opencode/workflow/PROJECT.md` for what this project's `{slot}` names resolve to.
