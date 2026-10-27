# Installing the workflow in a new project

Copy the bundle into the project root, then run any `/wf-*` command. The first one bootstraps the
project's own configuration.

## Step 1 — copy the bundle

From this repository's root, with `$DEST` the new project's root:

```bash
mkdir -p "$DEST/.opencode/commands" "$DEST/.opencode/skills" "$DEST/.opencode/plugins"
cp commands/wf-*.md "$DEST/.opencode/commands/"
cp -R skills/wf-* "$DEST/.opencode/skills/"
cp .opencode/plugins/tasks-todo-sync.ts "$DEST/.opencode/plugins/"
cp -R .opencode/workflow .opencode/tests "$DEST/.opencode/"
```

Copy those paths and no others. The skills and the commands sit at this repository's root and
belong under `.opencode/` in the project; anything else under `.opencode/` here is this
repository's own.

The plugin imports types from the opencode plugin SDK, which opencode installs into `.opencode/`
itself when it loads it.

| Path | What it is |
|---|---|
| `commands/wf-*.md` → `.opencode/commands/` | the seven slash commands; each loads its skill |
| `skills/wf-*/SKILL.md` → `.opencode/skills/` | the seven workflow steps |
| `.opencode/workflow/POLICY.md` | the workflow's rules — project-neutral, not edited per project |
| `.opencode/workflow/PROJECT.template.md` | every slot, empty; bootstrap fills it into `PROJECT.md` |
| `.opencode/workflow/changestat.ts` | the task counter |
| `.opencode/workflow/tasks.ts` | the checkbox parser, shared by the counter and the plugin |
| `.opencode/workflow/decisions/` | decision-record templates, copied on first use |
| `.opencode/workflow/invariants.template.md` | invariants-index template, copied on first use |
| `.opencode/plugins/tasks-todo-sync.ts` | reports when `tasks.md` and the session todo list disagree |
| `.opencode/tests/` | the bundle's own tests |

## Step 2 — run any `/wf-*` command

With no `PROJECT.md`, the skill runs `POLICY.md`'s "Bootstrap": it reads the project's build and
test entry points, proposes a value for every slot, confirms them with you, writes
`.opencode/workflow/PROJECT.md` and commits it. Everything else — `changes/`, the decision-record
directory, the invariants index — is created the first time a step needs it.

Five slots are required: `{format}`, `{lint}`, `{test}`, `{production-roots}` and
`{test-patterns}`. A required slot the project has no command for is written `none`, and every
step reports it as skipped. Every other slot may stay empty: the workflow degrades, it does not
break.

If you would rather fill it in by hand, copy `.opencode/workflow/PROJECT.template.md` to
`.opencode/workflow/PROJECT.md` and edit it.

## Step 3 — check it resolves

```bash
bun .opencode/workflow/changestat.ts     # "no active changes" on a fresh project
cd .opencode && bun test tests/          # green, including the self-containment test
```

Then `/wf-propose` something small and follow it through to `/wf-archive`. A project with a task
runner may give the bundle's tests a target of its own and list it under `PROJECT.md`'s
"Conditional gates" for `.opencode/`.

## What the bundle does not configure

These are properties of the workflow, and the counter and the plugin both parse them:

- a change lives in `changes/<name>/`;
- it holds `proposal.md`, `design.md`, `tasks.md`, plus `review.md` and `test_plan.md` once those
  steps run;
- archiving moves it to `changes/archive/YYYY-MM-DD-<name>/`;
- a task is a line-leading `- [ ] N.X` checkbox; a review fix is `- [ ] RN.X`.

## Changing the workflow afterwards

Directly. `POLICY.md`'s "The workflow is edited directly, never proposed" is the rule: a `wf-*`
skill, a `wf-*` command, `POLICY.md`, `PROJECT.md`, the counter, the parser or the plugin is a
direct commit with the bundle's tests green. No change directory, no proposal, no review round.

## Global installation

Not supported. The skills cite `.opencode/workflow/…` relative to the project root, which resolves
for a project-local install and not for `~/.config/opencode/skills/`.
