/**
 * tasks-todo-sync — report when a change's `tasks.md` and the session todo list disagree.
 *
 * `/wf-implement` keeps two copies of the same state: the `- [x]` checkboxes in
 * `changes/<name>/tasks.md`, which are the durable record, and the harness todo list, which is a
 * session mirror of it so the user can see progress without reading the file.
 *
 * The two drift, and they drift in one direction, for a structural reason. The checkbox has a
 * mechanical anchor: `wf-implement-change` bundles it into the per-group commit, so it cannot be
 * skipped without the commit being wrong, and it stays visible in the diff forever. The todo has
 * no anchor at all — nothing in the loop ever reads it back. The apply session's own closing
 * report counts `N/M` from `tasks.md`, so it reads correct while the sidebar is stale, and the
 * only detector of the drift is a human looking at the sidebar.
 *
 * The skill states the rule five times (steps 3 and 4, and three guardrails). Restating it a
 * sixth time was the available option and it is the one with the worst record, because the rule
 * is read once at session start and has to survive competing with everything else for the rest of
 * the session. So this reports the fact at the moment it becomes true instead, in the result of
 * the very edit that caused it.
 *
 * # What it cannot do
 *
 * It cannot fix the drift. The SDK exposes `session.todo` as a GET and there is no write
 * endpoint, so only the model can author the todo list via `todowrite`. Deriving the mirror
 * mechanically — the fix that would make the drift unrepresentable rather than merely reported —
 * is not available at this version. This is the next best thing: an unmissable fact rather than a
 * remembered rule.
 *
 * # What it deliberately stays silent about
 *
 * An apply session that never seeded the list at all. That is `wf-implement-change`'s
 * most-broken guardrail, and it needs no detector: an empty sidebar is visible to the user from
 * the first turn. This covers the failure that is *invisible*, which is the one worth machinery.
 *
 * Silence when in sync is the whole design. A reminder that fires on a correct edit teaches the
 * reader to skip it, and then it is worse than nothing — so every branch that is not a genuine
 * disagreement returns without touching the output.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { readFile } from "node:fs/promises"
import { basename } from "node:path"

/**
 * The file this watches, named as the counter names it. Matched on basename, so it applies
 * to an active change and an archived one alike.
 */
const TASKS_FILE = "tasks.md"

/** The tools that can have written it. `bash` is not among them: the skills edit files with `edit`. */
const EDIT_TOOLS = new Set(["edit", "write"])

/**
 * A task identifier: `4.1`, or `R2.13` for a review fix. It is the join key between a checkbox
 * line and its todo, which is why `wf-implement-change` requires a todo to be labelled with it.
 */
const TASK_ID = /^(R?\d+(?:\.\d+)+)\b/i

/** A todo is closed when it will not be worked again; `cancelled` counts, since nothing is pending. */
const CLOSED = new Set(["completed", "cancelled"])

/** The native tool that loads a skill. Its parameter schema is a single `name`. */
const SKILL_TOOL = "skill"

/**
 * A workflow skill. Matched on the prefix rather than a list of five names, so a sixth workflow
 * skill is in scope the moment it exists — the property is held by the match, not by anybody
 * remembering to extend a list. Anchored, so `not-wf-thing` is not a workflow skill.
 */
const WORKFLOW_SKILL = /^wf-/

type Tasks = { ticked: Set<string>; unticked: Set<string> }

/**
 * checkbox reports the mark inside a leading task checkbox, mirroring changestat's `checkbox`
 * exactly — both bullet characters, the mark at the front, the `]` behind it, and only at the
 * start of a line after indentation. Two parsers of one file must agree on what a task is, or the
 * two of them disagreeing becomes a third bug on top of the drift this is here to report.
 */
function checkbox(line: string): string | undefined {
  for (const bullet of ["- [", "* ["]) {
    if (!line.startsWith(bullet)) continue

    const rest = line.slice(bullet.length)
    if (rest.length < 2 || rest[1] !== "]") return undefined

    return rest[0]
  }

  return undefined
}

/**
 * parse splits a task list into the identifiers that are ticked and those that are not.
 *
 * A task line carrying no identifier is skipped rather than counted: it has no join key, so it
 * could only ever be reported as a phantom disagreement. The skills require a task line to carry
 * an identifier, and a `tasks.md` that stops doing so wants a skill fix, not a heuristic.
 */
function parse(body: string): Tasks {
  const ticked = new Set<string>()
  const unticked = new Set<string>()

  for (const line of body.split("\n")) {
    const mark = checkbox(line.replace(/^[ \t]+/, ""))
    if (mark === undefined) continue

    const id = line.slice(line.indexOf("]") + 1).trimStart().match(TASK_ID)?.[1]
    if (!id) continue

    if (mark === "x" || mark === "X") ticked.add(id)
    else unticked.add(id)
  }

  return { ticked, unticked }
}

export const TasksTodoSync: Plugin = async ({ client }) => {
  /**
   * reportSkillLoad states this session's todo list back to the model, inside the skill text it
   * just asked for.
   *
   * It deliberately does **not** judge. It cannot: at skill load no change has been selected, so
   * there is no `tasks.md` to compare against, and guessing which of the active changes a list
   * belongs to would be a heuristic wrong in the case that matters. Stating the contents is
   * enough — a resumed session recognises its own list, and a session inheriting one change's
   * list while being asked about another sees the mismatch immediately. The reader does the
   * judging because the reader is the only party with the information.
   *
   * Every todo is stated, labelled or not. The edit-time branch below filters on a task
   * identifier because there it is a *join key*; here there is nothing to join to, and an
   * unlabelled todo is exactly what a stale list looks like when the previous session was doing
   * something other than applying.
   */
  async function reportSkillLoad(
    input: { sessionID: string; args?: { name?: unknown } },
    output: { output: string },
  ) {
    try {
      const name = input.args?.name
      if (typeof name !== "string" || !WORKFLOW_SKILL.test(name)) return

      const todos = (await client.session.todo({ path: { id: input.sessionID } })).data ?? []

      const lines = [`\n\n<!-- tasks-todo-sync: this session's todo list, as ${name} loaded.`]

      if (todos.length === 0) {
        lines.push("  The list is empty.")
        lines.push(
          "  For /wf-implement that is an obligation — step 3 seeds it from tasks.md before any code.",
        )
        lines.push("  For /wf-archive it is correct. This hook does not know which; you do.")
      } else {
        for (const t of todos) lines.push(`  [${t.status}] ${t.content}`)
        lines.push(
          "  If this list is not the one this session should be working, re-seed it from tasks.md.",
        )
      }

      lines.push("-->")

      output.output += lines.join("\n")
    } catch {
      /*
       * Never let this break a skill load. The skill text is what the model asked for and this is
       * a progress display bolted onto it, so a session with no todo endpoint, or a bug above,
       * costs the report and nothing else.
       */
    }
  }

  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool === SKILL_TOOL) return await reportSkillLoad(input, output)

      try {
        if (!EDIT_TOOLS.has(input.tool)) return

        const path = input.args?.filePath
        if (typeof path !== "string" || basename(path) !== TASKS_FILE) return

        const tasks = parse(await readFile(path, "utf8"))
        if (tasks.ticked.size + tasks.unticked.size === 0) return

        const todos = (await client.session.todo({ path: { id: input.sessionID } })).data ?? []

        /*
         * Only todos labelled with a task identifier are considered, and if none is, this session's
         * list is not a mirror of any task file and nothing is said. That is what keeps the hook
         * quiet in the sessions that legitimately edit a `tasks.md` while tracking something else —
         * `/wf-propose` writing the list in the first place, `/wf-review` recording findings, or a
         * session whose todos are about the tooling rather than the change.
         */
        const mirror = todos.flatMap((t) => {
          const id = t.content.match(TASK_ID)?.[1]

          return id ? [{ id, closed: CLOSED.has(t.status) }] : []
        })

        if (mirror.length === 0) return

        const open = new Set(mirror.filter((t) => !t.closed).map((t) => t.id))
        const closed = new Set(mirror.filter((t) => t.closed).map((t) => t.id))

        // The reported case: the checkbox moved and the todo did not.
        const stale = [...open].filter((id) => tasks.ticked.has(id))
        // The mirror is missing a task, so the sidebar understates what is left.
        const absent = [...tasks.unticked].filter((id) => !open.has(id) && !closed.has(id))
        // The todo moved and the checkbox did not, which also means the group is not committable.
        const early = [...closed].filter((id) => tasks.unticked.has(id))

        if (stale.length + absent.length + early.length === 0) return

        const lines = [
          `\n\n<!-- tasks-todo-sync: ${basename(path)} and this session's todo list disagree.`,
        ]

        if (stale.length > 0) lines.push(`  ticked in the file, todo still open: ${stale.join(", ")}`)
        if (absent.length > 0) lines.push(`  unticked in the file, no todo at all: ${absent.join(", ")}`)
        if (early.length > 0) lines.push(`  unticked in the file, todo already closed: ${early.join(", ")}`)

        lines.push(
          "  The file is authoritative. Call todowrite to re-seed the list from it before the group commit. -->",
        )

        output.output += lines.join("\n")
      } catch {
        /*
         * Never let this break an edit. It is a progress display for a human, and the edit it is
         * attached to is the work — so a malformed task list, a session with no todo endpoint, or a
         * bug in the parsing above costs the reminder and nothing else.
         */
      }
    },
  }
}
