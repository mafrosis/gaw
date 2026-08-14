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

## Installing it

The skills and the commands live at this repository's root; in the project that uses them they
belong under `.opencode/`, which is where opencode looks. With `$DEST` the project's root:

```bash
mkdir -p "$DEST/.opencode/skills" "$DEST/.opencode/commands"
cp -R skills/wf-* "$DEST/.opencode/skills/"
cp commands/wf-*.md "$DEST/.opencode/commands/"
```

Then run any `/wf-*` command.

## Changing the workflow

Directly. A `wf-*` skill or a `wf-*` command is a direct commit: no change directory, no proposal,
no review round. The workflow is prose, and running the pipeline on the pipeline costs more than
the sentence it corrects.
