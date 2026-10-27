# Installing the workflow in a new project

Copy the bundle into the project, edit one file, done. The skills and the commands live at this
repository's root and belong under `.opencode/` in the project; everything else is already laid
out the way it installs. With `$DEST` the project's root:

```bash
mkdir -p "$DEST/.opencode/skills" "$DEST/.opencode/commands" "$DEST/.opencode/plugins"
cp -R skills/wf-* "$DEST/.opencode/skills/"
cp commands/wf-*.md "$DEST/.opencode/commands/"
cp .opencode/plugins/tasks-todo-sync.ts "$DEST/.opencode/plugins/"
cp -R .opencode/workflow .opencode/tests "$DEST/.opencode/"
```

That gives the project:

| Path | What it is |
|---|---|
| `.opencode/commands/wf-*.md` | the seven slash commands; each is a pointer to its skill |
| `.opencode/skills/wf-*/SKILL.md` | the seven workflow steps |
| `.opencode/workflow/POLICY.md` | the workflow's rules — project-neutral, do not edit per project |
| `.opencode/workflow/PROJECT.template.md` | every slot, empty; **the one file you edit** is the copy you make of it |
| `.opencode/workflow/changestat.ts` | the task counter |
| `.opencode/workflow/tasks.ts` | the checkbox parser, shared by the counter and the plugin |
| `.opencode/workflow/decisions/` | templates for a project with no decision-record directory |
| `.opencode/plugins/tasks-todo-sync.ts` | reports when `tasks.md` and the session todo list disagree |
| `.opencode/tests/` | the bundle's own tests |

## Step 1 — write `PROJECT.md` from the template

```bash
cp .opencode/workflow/PROJECT.template.md .opencode/workflow/PROJECT.md
```

Three command slots are **required**: `{format}`, `{lint}`, `{test}`. Two path slots are
required: `{production-roots}` (what a review may not edit) and `{test-patterns}` (the exception).
Leave every other slot empty until the project has something to put in it. An empty slot is
skipped and reported as skipped — the workflow degrades, it does not break.

## Step 2 — decide where decisions live

If the project has a decision-record directory, name it in `{decisions-dir}` and `{decisions-index}`.

If it does not, either:

- copy the templates in `.opencode/workflow/decisions/` into the directory you want the
  records in — `README.template.md` becomes its index and `0001-template.md` becomes the
  first record — then fill in the two slots; or
- leave both slots empty. `POLICY.md` then requires every durable decision to be stated in the
  change's own `design.md`, explicitly, rather than silently dropped.

## Step 3 — wire the bundle's tests into the project

The bundle ships tests for its own executable parts. Run them with bun, which is present wherever
opencode is — opencode loads and installs `.opencode/` with it:

```bash
cd .opencode && bun install && bun test tests/
```

Give that a task-runner target and name it in `{workflow-test}`. Nothing forces this, but
`tests/self-contained.test.ts` is what stops the next edit reintroducing a dependency on a file
that only existed in the project the workflow came from.

## Step 4 — check it resolves

```bash
bun .opencode/workflow/changestat.ts     # "no active changes" on a fresh project
cd .opencode && bun test tests/          # green, including the self-containment test
```

Then `/wf-propose` something small and watch it through to `/wf-archive`.

## What the bundle does not configure

These are properties of the workflow, not of the project, and the counter and the plugin both
parse them:

- a change lives in `changes/<name>/`;
- it holds `proposal.md`, `design.md`, `tasks.md`, plus `review.md` and `test_plan.md` once those
  steps run;
- archiving moves it to `changes/archive/YYYY-MM-DD-<name>/`;
- a task is a line-leading `- [ ] N.X` checkbox; a review fix is `- [ ] RN.X`.

## Changing the workflow afterwards

Directly. `POLICY.md`'s "The workflow is edited directly, never proposed" is the rule: a `wf-*`
skill, a `wf-*` command, `POLICY.md`, `PROJECT.md`, the counter, the parser or the plugin is a
direct commit with `{workflow-test}` green. No change directory, no proposal, no review round.

## Global installation

Not supported. The skills cite `.opencode/workflow/…` as a path relative to the project root,
which resolves for a project-local install and not for `~/.config/opencode/skills/`. Copy the
bundle per project.
