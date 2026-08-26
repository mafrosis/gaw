/**
 * tasks — the one parser for a change's `tasks.md`.
 *
 * Two things read that file mechanically: `changestat.ts`, which counts progress for the workflow
 * skills, and `../plugins/tasks-todo-sync.ts`, which compares the checkboxes against the session
 * todo list. Both used to carry their own copy of this logic — one in Go under `tools/`, one in
 * TypeScript in the plugin — with a comment in the plugin noting that "two parsers of one file must
 * agree on what a task is, or the two of them disagreeing becomes a third bug on top of the drift
 * this is here to report".
 *
 * That comment was a rule to remember. This module makes it a property of the code instead: there
 * is one implementation, so the two readers cannot disagree. It is also what makes the workflow
 * bundle portable — the Go tool needed a Go module, and this needs bun, which is present wherever
 * opencode is.
 */

/** The per-change task list. Fixed by the workflow, not a project slot. */
export const TASKS_FILE = "tasks.md"

/**
 * A task identifier: `4.1`, or `R2.13` for a review fix.
 *
 * It is the join key between a checkbox line and its todo, which is why `wf-implement-change`
 * requires a todo to be labelled with it.
 */
export const TASK_ID = /^(R?\d+(?:\.\d+)+)\b/i

/**
 * checkbox reports the mark inside a leading task checkbox, or undefined.
 *
 * A checkbox counts only when it opens a line, after optional indentation and a bullet: prose
 * mentioning a checkbox mid-sentence is not a task, and counting it would overstate the work. Both
 * bullet characters are accepted because both appear in practice, and an unticked box is a space.
 */
export function checkbox(line: string): string | undefined {
  const trimmed = line.replace(/^[ \t]+/, "")

  for (const bullet of ["- [", "* ["]) {
    if (!trimmed.startsWith(bullet)) continue

    const rest = trimmed.slice(bullet.length)
    if (rest.length < 2 || rest[1] !== "]") return undefined

    return rest[0]
  }

  return undefined
}

/** ticked reports whether a checkbox mark means done. Both cases appear in practice. */
export function ticked(mark: string): boolean {
  return mark === "x" || mark === "X"
}

/**
 * count tallies the task checkboxes in a task list.
 *
 * A task line carrying no identifier is still counted here, because progress is about the work
 * rather than about the join key. `split` below is the one that needs an identifier.
 */
export function count(body: string): { done: number; total: number } {
  let done = 0
  let total = 0

  for (const line of body.split("\n")) {
    const mark = checkbox(line)
    if (mark === undefined) continue

    total++

    if (ticked(mark)) done++
  }

  return { done, total }
}

/** The identifiers in a task list, partitioned by whether they are ticked. */
export type Tasks = { ticked: Set<string>; unticked: Set<string> }

/**
 * split splits a task list into the identifiers that are ticked and those that are not.
 *
 * A task line carrying no identifier is skipped rather than counted: it has no join key, so it
 * could only ever be reported as a phantom disagreement by the plugin. Every task list this
 * workflow has written numbers its tasks, and a `tasks.md` that stops doing so wants a skill fix,
 * not a heuristic.
 */
export function split(body: string): Tasks {
  const result: Tasks = { ticked: new Set<string>(), unticked: new Set<string>() }

  for (const line of body.split("\n")) {
    const mark = checkbox(line)
    if (mark === undefined) continue

    const id = line.slice(line.indexOf("]") + 1).trimStart().match(TASK_ID)?.[1]
    if (!id) continue

    if (ticked(mark)) result.ticked.add(id)
    else result.unticked.add(id)
  }

  return result
}
