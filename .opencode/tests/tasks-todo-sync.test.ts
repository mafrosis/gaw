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

/*
 * The per-request hook matches a candidate path on `changes/<name>/tasks.md`, so its fixtures have
 * to live at that shape rather than loose in the temp directory. The archived one is the case that
 * matters: it is entirely ticked, so comparing a live session against it would report every open
 * todo as stale on every request for the rest of the session.
 */
const ACTIVE_DIR = join(dir, "changes", "mirror-fixture")
const ARCHIVED_DIR = join(dir, "changes", "archive", "2026-01-01-old")
const ACTIVE = join(ACTIVE_DIR, "tasks.md")
const ARCHIVED = join(ARCHIVED_DIR, "tasks.md")
const GONE = join(dir, "changes", "deleted-by-archive", "tasks.md")

mkdirSync(ACTIVE_DIR, { recursive: true })
mkdirSync(ARCHIVED_DIR, { recursive: true })

/** Three tasks over two groups: 1.1 ticked, 1.2 and 2.1 not. */
writeFileSync(
  ACTIVE,
  `# Tasks — mirror fixture

## 1. Group one

- [x] 1.1 done
- [ ] 1.2 pending

## 2. Group two

- [ ] 2.1 later
`,
)

/** An archived change: every box ticked, which is what makes it dangerous to compare against. */
writeFileSync(ARCHIVED, "# Tasks — archived\n\n- [x] 1.1 done\n- [x] 1.2 also done\n- [x] 2.1 done\n")

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

/**
 * The single pre-joined element `LLMRequestPrep.prepare` hands the hook. Observed on 115 of 115
 * requests in a probe run, so a test that starts from an empty array would be testing
 * a shape the hook is never given.
 */
const PRE_JOINED = "You are OpenCode. <env>...</env>"

/**
 * driver builds one plugin instance and exposes the three ways a session reaches it: a tool call
 * that may carry a candidate path, a `todo.updated` event, and an LLM request.
 *
 * One instance per driver matters — the session cache lives inside the plugin factory, so sharing
 * an instance across tests would let one test's session leak into the next.
 */
async function driver(seed: Todo[] = [], seedThrows = false) {
  let queries = 0
  const client = {
    session: {
      todo: async () => {
        queries++
        if (seedThrows) throw new Error("no todo endpoint")

        return { data: seed }
      },
    },
  }

  const hooks = await TasksTodoSync({ client } as never)

  return {
    queries: () => queries,

    /** A tool call the session made, from which a candidate `tasks.md` path may be recorded. */
    saw: (tool: string, args: unknown, id = "ses_1") =>
      hooks["tool.execute.after"]!(
        { tool, sessionID: id, callID: "c", args } as never,
        { title: "", output: "", metadata: {} },
      ),

    /** The harness telling the plugin this session's list changed. */
    updated: (todos: Todo[], id = "ses_1") =>
      hooks["event"]!({ event: { type: "todo.updated", properties: { sessionID: id, todos } } } as never),

    /** Any other event the harness publishes. Most carry a `sessionID` and no todos at all. */
    emit: (type: string, properties: Record<string, unknown>) =>
      hooks["event"]!({ event: { type, properties } } as never),

    /** One LLM request. Returns the system array the model would have been sent. */
    request: async (id = "ses_1") => {
      const system = [PRE_JOINED]
      await hooks["experimental.chat.system.transform"]!({ sessionID: id, model: {} as never }, { system })

      return system
    },

    /**
     * One LLM request with no session at all, as `Agent.generate` makes.
     *
     * A separate method rather than `request(undefined)`, because a default parameter treats an
     * explicit `undefined` as absent and substitutes the default — so `request(undefined)` silently
     * ran as `ses_1` and the test passed while exercising the opposite of its name.
     */
    requestWithoutSession: async () => {
      const system = [PRE_JOINED]
      await hooks["experimental.chat.system.transform"]!({ model: {} as never } as never, { system })

      return system
    },
  }
}

/** The mirror that agrees with the ACTIVE fixture: 1.1 done, the other two still to do. */
const agreeing = () => [todo("1.1 done", "completed"), todo("1.2 pending"), todo("2.1 later")]

describe("the drift it restates on every request", () => {
  // Fails without the event hook: the session's todos are never cached, the lazy seed returns the
  // empty default, and the labelled-mirror gate stops it before any comparison.
  test("the cache is fed by todo.updated and keyed by session", async () => {
    const d = await driver([])
    await d.updated([todo("1.1 done"), todo("1.2 pending"), todo("2.1 later")])
    await d.saw("read", { filePath: ACTIVE })
    await d.saw("read", { filePath: ACTIVE }, "ses_2")

    expect((await d.request("ses_1")).join("\n")).toContain("1.1")
    // ses_2 was never published to, so its lookup falls to the seed, which is empty.
    expect(await d.request("ses_2")).toEqual([PRE_JOINED])
  })

  /*
   * Fails without the `seeded` flag: seeding on every request instead of once turns a per-request
   * hook into a per-request HTTP call, in every session, for the life of the process.
   */
  test("a session the plugin never saw created is seeded exactly once", async () => {
    const d = await driver([todo("1.1 done"), todo("1.2 pending"), todo("2.1 later")])
    await d.saw("read", { filePath: ACTIVE })

    expect((await d.request()).join("\n")).toContain("1.1")
    expect((await d.request()).join("\n")).toContain("1.1")
    expect(d.queries()).toBe(1)
  })

  /*
   * Fails without the event-type gate: `// if (event.type !== "todo.updated") return`, and the
   * suite stays green without it — which is why this test exists.
   *
   * The gate is not a filter for tidiness. Most published events carry a `sessionID` and no todos
   * — `session.diff`, `session.status`, `message.updated`, `permission.asked`. Without the gate
   * one of those destructures `todos` as `undefined` and stores it against the *real* session with
   * `seeded = true`, so the next request calls `mirrored(undefined)`, throws inside the transform
   * hook's try, and is swallowed. `seeded` is already true, so nothing ever re-fetches: the
   * session goes permanently silent for the rest of the process, with a green suite.
   *
   * That is the failure this plugin exists to prevent — drift persisting across several requests
   * with no report — reachable from the first unrelated event any session publishes.
   */
  test("an event that is not todo.updated does not poison the cache", async () => {
    const d = await driver([todo("1.1 done"), todo("1.2 pending"), todo("2.1 later")])
    await d.saw("read", { filePath: ACTIVE })
    await d.emit("session.diff", { sessionID: "ses_1", diff: [] })

    expect((await d.request()).join("\n")).toContain("todo still open: 1.1")
  })

  /*
   * Fails without `typeof text !== "string"` in recordCandidate: a non-string argument reaches
   * `candidate`, `text.match` throws, and because `recordCandidate` is called *outside*
   * `tool.execute.after`'s try, the throw escapes the hook and fails the tool call itself rather
   * than costing the reminder. Both this guard and the one below are therefore load-bearing for the
   * tool call, not just for the report.
   */
  test("a non-string path argument is ignored rather than thrown on", async () => {
    const d = await driver()
    await d.updated(agreeing())

    expect(d.saw("read", { filePath: 123 })).resolves.toBeUndefined()
  })

  /*
   * Fails without `if (!found) return undefined` in candidate: `String.match` answers null when
   * nothing matches, `null.reverse()` throws, and it escapes the hook for the same reason as above.
   * Every ordinary file a session reads takes this path.
   */
  test("a path naming no task file is ignored rather than thrown on", async () => {
    const d = await driver()
    await d.updated(agreeing())

    expect(d.saw("read", { filePath: "/Users/x/project/src/main.go" })).resolves.toBeUndefined()
  })

  // Fails without the labelled-mirror gate: an unrelated session's todos get compared to whatever
  // task file it happened to read, and every unticked task is reported as absent.
  test("a session whose todos are not a task mirror is left alone", async () => {
    const d = await driver()
    await d.updated([todo("Write the plugin"), todo("Verify it")])
    await d.saw("read", { filePath: ACTIVE })

    expect(await d.request()).toEqual([PRE_JOINED])
  })

  /*
   * Fails without the candidate-path gate — and `queries` is the assertion that makes it fail.
   *
   * The first version of this test published the todos by event and asserted only that nothing was
   * appended. It passed with the gate removed: the read was reached with `undefined`, threw, and the
   * catch swallowed it, so the test was asserting the error handling under the name of the gate.
   * Driving the lazy seed instead makes the gate observable, because without it the session pays a
   * GET to establish todos it can never report on.
   */
  test("labelled todos with no task file in hand say nothing, and cost no lookup", async () => {
    const d = await driver(agreeing())

    expect(await d.request()).toEqual([PRE_JOINED])
    expect(d.queries()).toBe(0)
  })

  // Fails without `bash` in the tools scanned, or without scanning the command text rather than a
  // filePath argument. wf-implement-change step 2 says "read all of them" without saying how, and
  // `cat changes/<name>/tasks.md` is a legal reading of that instruction.
  test.each([
    ["read", { filePath: ACTIVE }],
    ["edit", { filePath: ACTIVE }],
    ["write", { filePath: ACTIVE }],
    ["bash", { command: `sed -n '1,5p' ${ACTIVE}` }],
  ])("a candidate path is recorded from %s", async (tool, args) => {
    const d = await driver()
    await d.updated([todo("1.1 done"), todo("1.2 pending"), todo("2.1 later")])
    await d.saw(tool, args)

    expect((await d.request()).join("\n")).toContain("1.1")
  })

  /*
   * Fails without the `changes/archive/` rejection. This is the permanent false positive: an
   * archived task file is entirely ticked, so every open todo reads as `stale` on every request
   * until the session ends. The plugin's own test fixtures read an archived file, and a review
   * session reading one for reference is ordinary.
   */
  test("an archived task file is never a candidate", async () => {
    const d = await driver()
    await d.updated(agreeing())
    await d.saw("read", { filePath: ARCHIVED })

    expect(await d.request()).toEqual([PRE_JOINED])
  })

  /*
   * Fails if the archived path is rejected by taking the last match and testing it, rather than by
   * skipping archived matches while scanning backwards.
   *
   * Both readings agree when the two paths arrive in separate tool calls, which is why the test
   * above cannot tell them apart. They diverge when one command names both and the archived one is
   * last: "take the last, reject if archived" records nothing and the session goes blind, where
   * skipping finds the active file behind it.
   */
  test("an active path is found behind an archived one in the same command", async () => {
    const d = await driver()
    await d.updated([todo("1.1 done"), todo("1.2 pending"), todo("2.1 later")])
    await d.saw("bash", { command: `diff ${ACTIVE} ${ARCHIVED}` })

    expect((await d.request()).join("\n")).toContain("todo still open: 1.1")
  })

  // Fails if a later archive path overwrites the candidate rather than being ignored: the session
  // would start reporting against the archived file mid-run.
  test("an archived path does not displace an active one already seen", async () => {
    const d = await driver()
    await d.updated(agreeing())
    await d.saw("read", { filePath: ACTIVE })
    await d.saw("read", { filePath: ARCHIVED })

    // Still agreeing with the ACTIVE fixture, so still silent. Against ARCHIVED it would report
    // 1.2 and 2.1 as stale.
    expect(await d.request()).toEqual([PRE_JOINED])
  })

  /*
   * Fails without the `stale + absent + early === 0` short circuit. This is the property the
   * prompt cache depends on: nothing pushed means the array is byte-identical to what it is today,
   * so a correct session pays no cache prefix at all.
   */
  test("agreement leaves the system array untouched", async () => {
    const d = await driver()
    await d.updated(agreeing())
    await d.saw("read", { filePath: ACTIVE })

    const system = await d.request()
    expect(system).toEqual([PRE_JOINED])
    expect(system).toHaveLength(1)
  })

  // Fails without the push: the disagreement is computed and then dropped.
  test("a stale mirror is reported, and reported again on the next request", async () => {
    const d = await driver()
    await d.updated([todo("1.1 done"), todo("1.2 pending"), todo("2.1 later")])
    await d.saw("read", { filePath: ACTIVE })

    const first = await d.request()
    expect(first).toHaveLength(2)
    expect(first[1]).toContain("ticked in the file, todo still open: 1.1")

    // Ignoring it is not a one-time decision — the obligation recurs until the list is fixed.
    const second = await d.request()
    expect(second).toHaveLength(2)
    expect(second[1]).toContain("1.1")
  })

  /*
   * The window `wf-implement-change` step 4 opens, pinned deliberately.
   *
   * The loop ticks the checkbox and marks the todo `completed` as two separate tool calls, and each
   * step of a tool loop is its own LLM request — so between them the state is genuinely stale and
   * this fires on a session doing everything right. Accepted rather than suppressed, because the
   * block's instruction is exactly the call the loop is about to make. Suppressing it would need a
   * settle delay, which is state this hook would then have to be trusted to get right.
   *
   * Fails if a settle delay or a "recently edited" exemption is ever added: this stops reporting.
   */
  test("the tick-then-todowrite window does report, by choice", async () => {
    const d = await driver()
    await d.updated([todo("1.1 done", "in_progress"), todo("1.2 pending"), todo("2.1 later")])
    await d.saw("read", { filePath: ACTIVE })

    expect((await d.request()).join("\n")).toContain("todo still open: 1.1")
  })

  /*
   * `Agent.generate` triggers this hook with `{ model }` and no session, so this path is taken in
   * practice. It is pinned as a behaviour rather than as a guard: the plugin has no separate
   * no-session branch, because a request with no session can hold no recorded task file either, so
   * the one path gate answers both. The comment on that gate records why splitting them would leave
   * the second unprovable.
   */
  test("a request with no session says nothing", async () => {
    const d = await driver(agreeing())
    await d.saw("read", { filePath: ACTIVE })

    expect(await d.requestWithoutSession()).toEqual([PRE_JOINED])
    expect(d.queries()).toBe(0)
  })

  /*
   * Fails without the try/catch around the read. /wf-archive moves the change with `git mv`, so a
   * session that archives and then takes another turn holds a candidate path that no longer
   * resolves.
   */
  test("a task file moved out from under the session says nothing", async () => {
    const d = await driver()
    await d.updated(agreeing())
    await d.saw("read", { filePath: GONE })

    expect(await d.request()).toEqual([PRE_JOINED])
  })

  /*
   * Fails without the try/catch around the whole body — the highest-consequence guard here. The
   * edit-time hook can only spoil one edit; this one sits on every request in every session, so an
   * unhandled rejection breaks the conversation rather than the reminder.
   */
  test("a throwing lookup costs the report and not the request", async () => {
    const d = await driver([], true)
    await d.saw("read", { filePath: ACTIVE })

    expect(await d.request()).toEqual([PRE_JOINED])
  })

  // Fails if the two blocks are worded alike: a reader cannot tell which hook fired, and the two
  // report at different moments for different reasons.
  test("its wording is distinguishable from the edit-time comment", async () => {
    const d = await driver()
    await d.updated([todo("1.1 done"), todo("1.2 pending"), todo("2.1 later")])
    await d.saw("read", { filePath: ACTIVE })

    const block = (await d.request())[1]!
    // The edit-time hook emits an HTML comment into a tool result; this is system-prompt text.
    expect(block).not.toContain("<!--")
    expect(block).toContain("every request")
  })
})
