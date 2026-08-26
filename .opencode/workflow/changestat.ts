#!/usr/bin/env bun
/**
 * changestat — report how far each change under `changes/` has been implemented.
 *
 * It counts the task checkboxes in a change's tasks.md and prints, per change, how many are ticked.
 * With -verify it exits non-zero unless every task is ticked, which is what the archive checkpoint
 * gates on.
 *
 * It exists because task counting is the only piece of tooling the workflow genuinely needs, and
 * the skills reference it at every step. It is deliberately about thirty lines of logic on top of
 * `tasks.ts` rather than a dependency, and it is written in TypeScript rather than in the host
 * project's language so that the `.opencode/` bundle can be copied into a project of any stack and
 * work there: bun is present wherever opencode is, because opencode loads and installs `.opencode/`
 * with it.
 *
 * # What it cannot tell you
 *
 * A ticked box means somebody wrote `[x]`. It says nothing about whether the work was done, tested,
 * or reviewed — the review checkpoints are what judge that, and a tool that counted them would be
 * measuring prose. So -verify answers "does this change claim to be finished", not "is this change
 * finished", and the archive checkpoint pairs it with a human or agent having read the review.
 *
 * It refuses a root directory it cannot read rather than printing "no active changes". The two must
 * not look alike: the first is a mistyped path, the second is the answer a caller acts on. A green
 * report on a wrong input is worse than an error.
 */

import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"

import { count, TASKS_FILE } from "./tasks.ts"

/** Where changes live. Fixed by the workflow; see PROJECT.md's "What is fixed, and not a slot". */
const DEFAULT_ROOT = "changes"

/**
 * Completed changes. Excluded from a listing because an archived change is complete by definition,
 * but it can still be named directly: the archive checkpoint verifies a change after moving it.
 */
export const ARCHIVE_DIR = "archive"

export const COMPLETE = "complete"
export const IN_PROGRESS = "in progress"
export const UNKNOWN = "unknown"

/**
 * Exit codes. A verify failure is distinguished from an operational error so a caller can tell
 * "work remains" from "I could not look".
 */
export const EXIT_ERROR = 1
export const EXIT_UNMET = 2

/**
 * One change directory's task progress.
 *
 * A change whose task list could not be read carries `error` rather than being dropped: one
 * unreadable change must not hide the state of the others, and it must not read as complete.
 */
export type Change = { name: string; done: number; total: number; error?: string }

function state(c: Change): string {
  if (c.error !== undefined) return UNKNOWN
  if (c.total > 0 && c.done === c.total) return COMPLETE

  return IN_PROGRESS
}

/**
 * read counts one change's tasks. A missing task list is recorded on the change rather than thrown,
 * so a listing survives it.
 */
async function read(root: string, name: string): Promise<Change> {
  try {
    const body = await readFile(join(root, name, TASKS_FILE), "utf8")
    const { done, total } = count(body)

    return { name, done, total }
  } catch (err) {
    const code = (err as { code?: string }).code

    return {
      name,
      done: 0,
      total: 0,
      error: code === "ENOENT" ? `no ${TASKS_FILE}` : String(err),
    }
  }
}

/**
 * scan reports every active change under root, ordered by name so the output is diffable. The
 * archive is excluded; see ARCHIVE_DIR.
 */
export async function scan(root: string): Promise<Change[]> {
  let entries

  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (err) {
    throw new Error(`reading ${root}: ${(err as { message?: string }).message ?? err}`)
  }

  const dirs = entries.filter((e) => e.isDirectory() && e.name !== ARCHIVE_DIR).map((e) => e.name)
  const found = await Promise.all(dirs.map((name) => read(root, name)))

  return found.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/**
 * selected reports one change by name, which may be an archived one given its path relative to
 * root.
 */
export async function selected(root: string, name: string): Promise<Change[]> {
  const dir = join(root, name)

  try {
    if (!(await stat(dir)).isDirectory()) throw new Error("not a directory")
  } catch {
    throw new Error(`no change named "${name}" under ${root}`)
  }

  return [await read(root, name)]
}

/**
 * incomplete returns the changes that have not been shown to be complete: any with a task
 * outstanding, and any whose task list could not be read. The second case matters — a change with
 * no task list has not been shown to be finished, so treating it as finished is the one mistake
 * -verify exists to prevent.
 */
export function incomplete(cs: Change[]): Change[] {
  return cs.filter((c) => c.error !== undefined || c.total === 0 || c.done !== c.total)
}

export function report(cs: Change[]): string {
  if (cs.length === 0) return "no active changes\n"

  const width = Math.max(...cs.map((c) => c.name.length))

  return cs
    .map((c) =>
      c.error !== undefined
        ? `${c.name.padEnd(width)}  ${UNKNOWN} (${c.error})`
        : `${c.name.padEnd(width)}  ${c.done}/${c.total}  ${state(c)}`,
    )
    .join("\n")
    .concat("\n")
}

/** flag reads `-name=value` or `-name value` from argv, mirroring Go's flag package closely enough. */
function flag(argv: string[], name: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!

    for (const prefix of [`-${name}`, `--${name}`]) {
      if (arg === prefix) return argv[i + 1]?.startsWith("-") === false ? argv[i + 1] : ""
      if (arg.startsWith(`${prefix}=`)) return arg.slice(prefix.length + 1)
    }
  }

  return undefined
}

function has(argv: string[], name: string): boolean {
  return argv.includes(`-${name}`) || argv.includes(`--${name}`)
}

export async function main(argv: string[]): Promise<number> {
  const root = flag(argv, "root") || DEFAULT_ROOT
  const name = flag(argv, "change") || ""
  const verify = has(argv, "verify")

  let found: Change[]

  try {
    found = name !== "" ? await selected(root, name) : await scan(root)
  } catch (err) {
    console.error("changestat:", (err as { message?: string }).message ?? err)

    return EXIT_ERROR
  }

  process.stdout.write(report(found))

  if (verify) {
    const unmet = incomplete(found)

    if (unmet.length > 0) {
      console.error(`changestat: ${unmet.length} change(s) not complete`)

      return EXIT_UNMET
    }
  }

  return 0
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)))
