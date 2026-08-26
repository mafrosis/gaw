# gaw

Guided Agent Workflow: a portable bundle of [opencode](https://opencode.ai) skills and slash
commands that carries a change from a proposal to an archived record, with a review round and a
decision record wherever the change earns one. Copy it into a project and the workflow is the
project's; nothing here is specific to the repository it was written in.

## What is in here

| Path | What it is |
|---|---|
| `skills/wf-*/SKILL.md` | the workflow's stages, and `wf-explore` for thinking before one |
| `commands/wf-*.md` | the slash commands; each is a pointer to its skill |
| `.opencode/workflow/POLICY.md` | the rules, project-neutral; not edited per project |
| `.opencode/workflow/PROJECT.template.md` | every slot, empty; the project's copy is its own |
| `.opencode/workflow/decisions/` | decision-record templates, for a project with none |
| `.opencode/plugins/tasks-todo-sync.ts` | reports when `tasks.md` and the session's todo list disagree |
| `.opencode/tests/` | the bundle's own tests |

## Installing it

The skills and the commands live at this repository's root; in the project that uses them they
belong under `.opencode/`, which is where opencode looks. With `$DEST` the project's root:

```bash
mkdir -p "$DEST/.opencode/skills" "$DEST/.opencode/commands" "$DEST/.opencode/plugins"
cp -R skills/wf-* "$DEST/.opencode/skills/"
cp commands/wf-*.md "$DEST/.opencode/commands/"
cp .opencode/plugins/tasks-todo-sync.ts "$DEST/.opencode/plugins/"
cp -R .opencode/workflow .opencode/tests "$DEST/.opencode/"
```

Then copy `.opencode/workflow/PROJECT.template.md` to `.opencode/workflow/PROJECT.md` and
fill in the tables: they are where the workflow's `{slot}` names resolve to this project's own
commands and paths. `INSTALL.md` beside the template is the long version.

## Declaring an invariants check

Of the optional slots, `{invariants}` and `{invariants-index}` are the two worth filling in early.

An invariant here is a claim quantified over a set the code can enumerate — "every write validates
its identifier", "every route requires identity". A hand-written test asserts one case and says
nothing about the set, so the index records the claim beside the artefact that enforces it, and
`{invariants}` is the project's own command for checking that every row still names something that
exists. A renamed test then fails a check instead of quietly rotting in a table.

Point `{invariants-index}` at a file, copy `invariants.template.md` to it, and give the project a
command that resolves the rows — a test that walks the index is enough, and it then runs inside
`{test}` as well.

Leave the slots empty and the workflow still runs: every step that would have checked the index
says the rows were not checked mechanically. That is the rule the whole bundle is built on — an
unrun check and a passing one must never read alike — but it is a weaker position than having the
check.

## The bundle's own tests

```bash
cd .opencode && bun test tests/
```

They cover the todo-sync plugin.

## Changing the workflow

Directly. A `wf-*` skill or a `wf-*` command is a direct commit: no change directory, no proposal,
no review round. The workflow is prose, and running the pipeline on the pipeline costs more than
the sentence it corrects.
