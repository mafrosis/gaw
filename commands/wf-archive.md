---
description: Archive a completed change. Use when the user wants to finalize and archive a change after implementation and review are complete.
---
Archive a completed change once its review gate and task completion are satisfied.

The argument after the command is the change name (kebab-case), or a description of
what you want. If it is missing, infer it from the conversation; ask rather than guess.

**Use the skill tool to load `wf-archive-change`, then follow it.** That skill is the single
source of truth for this workflow step — this file deliberately carries no copy of it,
because two copies drift and the copy is what gets read.

The skill will send you to `.opencode/workflow/POLICY.md` for the workflow's rules and
`.opencode/workflow/PROJECT.md` for what this project's `{slot}` names resolve to.
