/**
 * Tests for the tasks-todo-sync plugin.
 *
 * This lives in `.opencode/tests/` rather than beside the plugin because opencode loads *every*
 * file under `.opencode/plugins/` as a plugin module at startup, and a test file exports no plugin
 * function.
 *
 * Run with `cd .opencode && bun test tests/`.
 *
 * Each guard below has a mutation recorded on the test that proves it. The two that took a second
 * attempt are the interesting ones and both notes are kept: a test that passes because a file is
 * absent is not testing the guard it names, and two guards that mask each other are one guard.
 */

import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { TasksTodoSync } from "../plugins/tasks-todo-sync.ts"

const dir = mkdtempSync(join(tmpdir(), "tasks-todo-sync-"))
const TASKS = join(dir, "tasks.md")
const DESIGN = join(dir, "design.md")

/**
 * Eight tasks over two groups: two ticked, three unticked, one of them under a star bullet and one
 * a review fix. The preamble's last line is prose that carries a bullet, a box *and* an identifier,
 * so only its position in the line distinguishes it from a task.
 */
writeFileSync(
  TASKS,
  `# Tasks — fixture

Prose mentioning - [ ] 9.9 mid-sentence must not count as a task.

## 1. Group one

- [x] 1.1 done thing
      a continuation line, which is not a task
- [x] 1.2 another done thing
- [ ] 1.3 pending thing

## 2. Group two

- [ ] 2.1 later thing
* [ ] R1.4 a review fix, under a star bullet
`,
)

/** A sibling artifact that exists and carries task-shaped checkboxes. See the basename test. */
writeFileSync(DESIGN, "# Design — fixture\n\n- [ ] 1.1 not a task list\n- [x] 9.9 nor this\n")

type Todo = { id: string; content: string; status: string; priority: string }

const todo = (content: string, status = "pending"): Todo => ({ id: content, content, status, priority: "medium" })

/** The mirror `wf-implement-change` step 3 seeds for this fixture when nothing has been done yet. */
const seeded = () => [todo("1.1 done thing"), todo("1.2 another"), todo("1.3 pending"), todo("2.1 later"), todo("R1.4 fix")]

/** The same mirror once group 1 is finished — which is what agreement with the fixture looks like. */
const inSync = () => [
  todo("1.1 done thing", "completed"),
  todo("1.2 another", "completed"),
  todo("1.3 pending"),
  todo("2.1 later"),
  todo("R1.4 fix"),
]

const UNCHANGED = "PATCH"

/** run drives the hook over a stub client and reports the tool result the model would have seen. */
async function run(todos: Todo[], path = TASKS, tool = "edit") {
  let queried = false
  const client = {
    session: {
      todo: async () => {
        queried = true

        return { data: todos }
      },
    },
  }

  const hooks = await TasksTodoSync({ client } as never)
  const output = { title: "", output: UNCHANGED, metadata: {} }

  await hooks["tool.execute.after"]!({ tool, sessionID: "ses_1", callID: "c1", args: { filePath: path } }, output)

  return { text: output.output, queried }
}

describe("the drift it reports", () => {
  // Fails without the `stale` comparison: drop it and this reports nothing.
  test("a checkbox that moved while its todo stayed open", async () => {
    const { text } = await run([todo("1.1 done thing"), todo("1.2 another", "in_progress"), todo("1.3 pending")])

    expect(text).toContain("ticked in the file, todo still open: 1.1, 1.2")
  })

  // Fails without the `absent` comparison.
  test("an unticked task with no todo at all", async () => {
    const { text } = await run([todo("1.1 x", "completed"), todo("1.2 x", "completed"), todo("1.3 pending")])

    expect(text).toContain("no todo at all: 2.1, R1.4")
  })

  // Fails without the `early` comparison.
  test("a todo closed ahead of its checkbox, which also blocks the group commit", async () => {
    const { text } = await run([...inSync().slice(0, 2), todo("1.3 pending", "completed"), todo("2.1 later"), todo("R1.4 fix")])

    expect(text).toContain("todo already closed: 1.3")
  })

  // Fails without "cancelled" in CLOSED: the todo reads as open and nothing is reported.
  test("a cancelled todo counts as closed, since nothing is pending", async () => {
    expect((await run([todo("1.3 pending thing", "cancelled")])).text).toContain("closed: 1.3")
  })

  // Fails without "* [" in checkbox's bullet list: R1.4 stops being seen as a task.
  test("a star bullet is a task", async () => {
    expect((await run([todo("1.1 x", "completed"), todo("1.2 x", "completed"), todo("1.3 p")])).text).toContain("R1.4")
  })
})

describe("the silence, which is the whole design", () => {
  // Fails without the `stale + absent + early === 0` guard: every edit reports something, and a
  // reminder that fires when nothing is wrong teaches the reader to skip it.
  test("agreement says nothing", async () => {
    expect((await run(inSync())).text).toBe(UNCHANGED)
  })

  // Fails without the `mirror.length === 0` guard.
  test("todos that are not a task mirror are not a task mirror", async () => {
    expect((await run([todo("Write the plugin"), todo("Verify it")])).text).toBe(UNCHANGED)
  })

  // Fails without the same guard: an empty list is /wf-propose writing the file, not apply drift.
  test("an empty todo list is a session that is not applying", async () => {
    expect((await run([])).text).toBe(UNCHANGED)
  })

  // Fails without checkbox's line-start anchoring AND its `]` check — mutating either alone is
  // masked by the other, so the proof is removing both: `indexOf(bullet)` with no `]` check
  // reports the preamble's 9.9 as an unticked task.
  test("a checkbox mid-sentence is prose", async () => {
    expect((await run(inSync())).text).not.toContain("9.9")
  })

  // Fails without the EDIT_TOOLS set.
  test("a tool that did not write the file", async () => {
    expect((await run(seeded(), TASKS, "read")).text).toBe(UNCHANGED)
  })

  /*
   * Fails without the basename check — but only because design.md exists and carries checkboxes.
   * The first version of this test pointed at a path that did not exist, so it passed with the
   * guard removed: the read threw and the catch swallowed it. It was asserting the error handling,
   * under the name of the scope check.
   */
  test("a sibling artifact that merely looks like a task list", async () => {
    const { text, queried } = await run(seeded(), DESIGN)

    expect(text).toBe(UNCHANGED)
    expect(queried).toBe(false)
  })

  // Fails without the try/catch: the read rejects and the unhandled rejection fails the edit that
  // the hook is attached to, which is the work.
  test("an unreadable file costs the reminder and nothing else", async () => {
    expect((await run(seeded(), join(dir, "absent", "tasks.md"))).text).toBe(UNCHANGED)
  })
})

/**
 * runSkill drives the skill-load hook and reports the skill text the model would have seen.
 *
 * `wf-implement-change` is the default name because it is the skill whose failure prompted this:
 * a session that loads it and starts on the previous session's list.
 */
async function runSkill(todos: Todo[], name = "wf-implement-change", throws = false) {
  let queried = false
  const client = {
    session: {
      todo: async () => {
        queried = true
        if (throws) throw new Error("no todo endpoint")

        return { data: todos }
      },
    },
  }

  const hooks = await TasksTodoSync({ client } as never)
  const output = { title: "", output: UNCHANGED, metadata: {} }

  await hooks["tool.execute.after"]!({ tool: "skill", sessionID: "ses_1", callID: "c1", args: { name } }, output)

  return { text: output.output, queried }
}

describe("the list it states when a workflow skill loads", () => {
  // Fails without the skill branch in tool.execute.after: nothing is appended at all.
  test("every todo is stated with its status", async () => {
    const { text } = await runSkill(inSync())

    expect(text).toContain("1.1 done thing")
    expect(text).toContain("completed")
    expect(text).toContain("2.1 later")
    expect(text).toContain("pending")
  })

  /*
   * Fails without the empty-list branch: with `todos.length === 0` falling through to the loop,
   * the block is emitted with no lines and says nothing a reader can act on.
   *
   * Silence is wrong here, which is the one place this hook differs from the edit-time one. An
   * empty list is an obligation for /wf-implement (step 3 has not run) and correct for
   * /wf-archive (the change is gone), and the plugin cannot tell which — so it reports the fact
   * and lets the reader judge.
   */
  test("an empty list is stated as empty rather than passed over", async () => {
    const { text, queried } = await runSkill([])

    expect(text).not.toBe(UNCHANGED)
    expect(text).toContain("empty")
    expect(queried).toBe(true)
  })

  // Fails without the WORKFLOW_SKILL prefix test — and the `queried` assertion is the half that
  // matters: ordering the guard after the lookup would still append nothing while costing an
  // HTTP call on every unrelated skill load.
  test("a skill outside the workflow is not a workflow skill", async () => {
    const { text, queried } = await runSkill(inSync(), "ast-grep")

    expect(text).toBe(UNCHANGED)
    expect(queried).toBe(false)
  })

  /*
   * Fails if the skill branch reuses the edit branch's TASK_ID filter.
   *
   * At skill load there is no task file to join against, so an identifier has nothing to be a join
   * key *for* — and an unlabelled todo is precisely what a stale list looks like when the previous
   * session was doing something other than applying. Filtering here would hide the case the hook
   * exists to surface.
   */
  test("a todo carrying no task identifier is stated too", async () => {
    const { text } = await runSkill([todo("Write the plugin"), todo("Verify it", "completed")])

    expect(text).toContain("Write the plugin")
    expect(text).toContain("Verify it")
  })

  // Fails without the skill branch's own try/catch: the rejection propagates and the skill load
  // fails, costing the model the instructions it just asked for.
  test("a failing todo lookup costs the report and not the skill", async () => {
    expect((await runSkill(inSync(), "wf-implement-change", true)).text).toBe(UNCHANGED)
  })

  // Fails without the prefix anchor (`/^wf-/` → `/wf-/`): a skill merely containing the prefix
  // would be treated as a workflow skill.
  test("the prefix is anchored at the start of the name", async () => {
    expect((await runSkill(inSync(), "not-wf-implement-change")).text).toBe(UNCHANGED)
  })
})

describe("a full-sized task list", () => {
  /*
   * 68 tasks over 8 groups, with continuation lines, backticks and em-dashes, and exactly one task
   * left unticked at 8.3 — the shape of a real completed change rather than a three-line fixture.
   * The scale is the point: `absent` is computed from unticked tasks alone, and with 67 ticked
   * tasks carrying no todo, a mistake there is 67 phantom reports rather than one.
   *
   * Generated rather than read from a real change: an active change is ticked by other sessions
   * while the test runs, and any change at all is a host-project file the bundle must not depend
   * on.
   */
  const BIG_DIR = join(dir, "changes", "full-sized-fixture")
  const BIG = join(BIG_DIR, "tasks.md")

  mkdirSync(BIG_DIR, { recursive: true })

  writeFileSync(
    BIG,
    (() => {
      const lines = ["# Tasks — full-sized fixture", ""]
      let n = 0

      for (let group = 1; group <= 8; group++) {
        lines.push(`## ${group}. Group ${group}`, "")

        for (let task = 1; task <= (group === 8 ? 5 : 9); task++) {
          n++
          const id = `${group}.${task}`
          const done = id === "8.3" ? " " : "x"

          lines.push(`- [${done}] ${id} do the \`thing\` — with an em-dash and a continuation`)
          lines.push(`      that wraps onto a second line, as a real task list does`)
        }

        lines.push("")
      }

      // The count the comment above claims, asserted rather than trusted.
      if (n !== 68) throw new Error(`fixture generated ${n} tasks, expected 68`)

      return lines.join("\n")
    })(),
  )

  test("a mirror lagging its committed checkboxes is reported", async () => {
    const { text } = await run([todo("1.1 do the thing"), todo("8.3 do the thing")], BIG)

    expect(text).toContain("ticked in the file, todo still open: 1.1")
    expect(text).not.toContain("8.3")
  })

  /*
   * The resumed-session case, and the reason `absent` is computed from unticked tasks alone: step 3
   * seeds one todo per *unticked* task, so the 67 ticked ones having no todo is correct and must
   * not be reported.
   */
  test("a correctly seeded resumed session is silent", async () => {
    expect((await run([todo("8.3 do the thing")], BIG)).text).toBe(UNCHANGED)
  })
})
