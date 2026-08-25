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

/**
 * A candidate task file, as it appears in a tool argument or a shell command.
 *
 * The edit-time hook matches on basename alone, deliberately, so it covers an archived change too —
 * correct for reporting an edit. The per-request hook cannot afford that: an archived `tasks.md` is
 * entirely ticked, so comparing a live session's open todos against it makes every one of them
 * `stale` on every request for the rest of the session. So this wants the full shape, and archived
 * paths are rejected separately below rather than left to the pattern by luck.
 */
const TASKS_PATH = /[^\s"'`;|&]*changes\/[^\s"'`;|&]*tasks\.md/g

/** Where an archived change lives. Never a candidate; see above. */
const ARCHIVED = "changes/archive/"

/** The tools whose arguments can name a task file, and the argument each names it in. */
const PATH_ARG = "filePath"
const COMMAND_ARG = "command"

type Tasks = { ticked: Set<string>; unticked: Set<string> }

/** A todo reduced to what the comparison needs: its task identifier and whether it is done with. */
type Mirrored = { id: string; closed: boolean }

/** The three ways a mirror can disagree with its file. Absent means no disagreement. */
type Drift = { stale: string[]; absent: string[]; early: string[] }

/** What the plugin remembers about one session, for its whole process lifetime. */
type Session = {
  todos: { content: string; status: string }[]
  /** Whether the list has been established, by event or by the one lazy GET. */
  seeded: boolean
  /** The last active `changes/<name>/tasks.md` this session was seen handling. */
  tasksPath?: string
}

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

/**
 * mirrored reduces a todo list to the entries that carry a task identifier.
 *
 * A todo without one has no join key, so it could only ever be reported as a phantom
 * disagreement — and a list where *none* of them has one is not a mirror of any task file. That
 * emptiness is the gate both comparing hooks lean on to stay quiet in a session tracking something
 * other than a change.
 */
function mirrored(todos: { content: string; status: string }[]): Mirrored[] {
  return todos.flatMap((t) => {
    const id = t.content.match(TASK_ID)?.[1]

    return id ? [{ id, closed: CLOSED.has(t.status) }] : []
  })
}

/**
 * compare names the three ways a mirror can disagree with its file, or reports nothing when they
 * agree. Silence on agreement is the whole design: a reminder that fires when nothing is wrong
 * teaches the reader to skip it, and then it is worse than nothing.
 */
function compare(tasks: Tasks, mirror: Mirrored[]): Drift | undefined {
  const open = new Set(mirror.filter((t) => !t.closed).map((t) => t.id))
  const closed = new Set(mirror.filter((t) => t.closed).map((t) => t.id))

  // The reported case: the checkbox moved and the todo did not.
  const stale = [...open].filter((id) => tasks.ticked.has(id))
  // The mirror is missing a task, so the sidebar understates what is left.
  const absent = [...tasks.unticked].filter((id) => !open.has(id) && !closed.has(id))
  // The todo moved and the checkbox did not, which also means the group is not committable.
  const early = [...closed].filter((id) => tasks.unticked.has(id))

  if (stale.length + absent.length + early.length === 0) return undefined

  return { stale, absent, early }
}

/** describe renders a drift as one line per disagreeing kind, indented for reading. */
function describe(drift: Drift): string[] {
  const lines: string[] = []

  if (drift.stale.length > 0) lines.push(`  ticked in the file, todo still open: ${drift.stale.join(", ")}`)
  if (drift.absent.length > 0) lines.push(`  unticked in the file, no todo at all: ${drift.absent.join(", ")}`)
  if (drift.early.length > 0) lines.push(`  unticked in the file, todo already closed: ${drift.early.join(", ")}`)

  return lines
}

/**
 * candidate reports the task file named in a piece of text, or nothing.
 *
 * The last match wins, so a session that moves from one change to another compares against the one
 * it is handling now. An archived path is never returned, and because it is skipped rather than
 * returned-and-rejected, it cannot displace an active path already recorded.
 */
function candidate(text: string): string | undefined {
  const found = text.match(TASKS_PATH)
  if (!found) return undefined

  for (const path of found.reverse()) {
    if (!path.includes(ARCHIVED)) return path
  }

  return undefined
}

export const TasksTodoSync: Plugin = async ({ client }) => {
  /**
   * What the plugin knows per session, for the lifetime of the opencode process.
   *
   * Keyed by `sessionID`, so a subagent — which fires these hooks under its own id — is a separate
   * entry and cannot be confused with its parent. Each entry is a handful of strings, and the map
   * is bounded by the process, so nothing prunes it.
   */
  const sessions = new Map<string, Session>()

  const of = (id: string): Session => {
    const existing = sessions.get(id)
    if (existing) return existing

    const fresh: Session = { todos: [], seeded: false }
    sessions.set(id, fresh)

    return fresh
  }

  /**
   * todosFor answers from memory, and reaches for the network once per session at most.
   *
   * The `todo.updated` event carries the full list, so a session whose todos were created while
   * this plugin was loaded costs nothing. The GET exists for the other case — a session resumed
   * with todos the plugin never saw created, which is what an opencode restart produces — and
   * `seeded` is set whatever the call returns, so a session with no todos does not re-ask on every
   * request for the rest of the process.
   *
   * It resolves the session itself rather than taking one, which is what makes the caller's gate
   * provable: removing that gate reaches this function, which creates an entry and spends a GET,
   * and a test counting lookups can see the difference. Handed an already-resolved session, the
   * gate's removal would instead fault on `undefined` and be swallowed by the caller's catch.
   */
  async function todosFor(id: string) {
    const session = of(id)
    if (session.seeded) return session.todos

    session.seeded = true
    session.todos = (await client.session.todo({ path: { id } })).data ?? []

    return session.todos
  }


  /**
   * recordCandidate notes a task file this session is handling, from a tool's own arguments.
   *
   * Both a path argument and a shell command are scanned, because `wf-implement-change` step 2 says
   * to read the change's artifacts without saying with which tool, and `cat changes/<n>/tasks.md`
   * is a legal reading of that. `changestat CHANGE=<n>` names no path and so seeds nothing; that
   * residual gap is a missed report rather than a wrong one, and the skill-load hook still fires
   * for it.
   */
  function recordCandidate(tool: string, args: Record<string, unknown> | undefined, id: string) {
    const text = args?.[PATH_ARG] ?? args?.[COMMAND_ARG]
    if (typeof text !== "string") return

    const found = candidate(text)
    if (!found) return

    of(id).tasksPath = found
  }

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
    /**
     * The list changed, so the cached copy is replaced. This is what keeps the per-request hook off
     * the network in the steady state: the event carries the whole list, not a delta.
     */
    event: async ({ event }) => {
      if (event.type !== "todo.updated") return

      const { sessionID, todos } = event.properties
      const session = of(sessionID)

      session.todos = todos
      session.seeded = true
    },

    /**
     * Restate the disagreement on every request until it is fixed.
     *
     * The edit-time hook below reports at the instant drift is *created*, which is the cheapest
     * moment to fix it, and it reports once. This reports for as long as the session is *wrong*, so
     * ignoring it stops being a one-time decision. The two are kept distinct in wording.
     *
     * Silence when the mirror agrees is what makes it affordable: nothing is pushed, so the array
     * is byte-identical to what it is today and the prompt cache sees no change.
     */
    "experimental.chat.system.transform": async (input, output) => {
      try {
        /*
         * One gate, not two. `Agent.generate` triggers this hook with no session at all, and a
         * request with no session can hold no recorded task file either — so "no session" and "no
         * candidate path" are one outcome by construction, and writing them as two guards would
         * leave the second unprovable, since with either removed the read is reached with
         * `undefined` and the catch below swallows it.
         *
         * The path is checked before the todos are established because it is a pure map lookup
         * where establishing the todos may cost the one lazy GET. A session with no task file in
         * hand can never report anything, so paying the network to find that out would be waste —
         * and that saving is what makes this gate provable: remove it and `todosFor` spends a GET
         * a test can count. The conditional lookup is a narrowing rather than a third guard;
         * `sessions.get(undefined)` would answer the same, just less plainly.
         */
        const tasksPath = input.sessionID ? sessions.get(input.sessionID)?.tasksPath : undefined
        if (!tasksPath) return

        const mirror = mirrored(await todosFor(input.sessionID!))
        if (mirror.length === 0) return

        /*
         * No "is this file empty" guard here, unlike the edit branch. There it returns before the
         * todo lookup and so saves a call; here the todos are already in hand, and an empty file
         * yields an empty drift from `compare` anyway — so the guard would be unobservable, and an
         * unobservable guard cannot be proven by a test that fails without it.
         */
        const tasks = parse(await readFile(tasksPath, "utf8"))

        const drift = compare(tasks, mirror)
        if (!drift) return

        output.system.push(
          [
            `tasks-todo-sync: this session's todo list disagrees with ${tasksPath}.`,
            ...describe(drift),
            "The file is authoritative. Call todowrite to re-seed the list from it.",
            "This is restated on every request until it agrees, so it is not a one-time notice.",
          ].join("\n"),
        )
      } catch {
        /*
         * The highest-consequence guard in this plugin. The edit-time hook can only spoil one edit;
         * this one sits on every request in every session, so an unhandled rejection here breaks
         * the conversation rather than a reminder. A moved task file — which /wf-archive's `git mv`
         * produces — reaches this path routinely.
         */
      }
    },

    "tool.execute.after": async (input, output) => {
      recordCandidate(input.tool, input.args, input.sessionID)

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
        const mirror = mirrored(todos)
        if (mirror.length === 0) return

        const drift = compare(tasks, mirror)
        if (!drift) return

        const lines = [
          `\n\n<!-- tasks-todo-sync: ${basename(path)} and this session's todo list disagree.`,
          ...describe(drift),
          "  The file is authoritative. Call todowrite to re-seed the list from it before the group commit. -->",
        ]

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
