#!/usr/bin/env bun
/**
 * changestat — report how far each change under `changes/` has been implemented.
 *
 *     bun .opencode/workflow/changestat.ts [-root <dir>] [-change <name>] [-verify]
 *
 * It counts the task checkboxes in a change's tasks.md and prints, per change, how many are ticked.
 * With -verify it exits 2 unless every task is ticked; exit 1 means it could not look (a bad
 * argument, an unreadable root, an unknown change). Written in TypeScript so the bundle runs under
 * the bun that opencode already uses, whatever the host project's stack.
 *
 * A ticked box is a claim that the work was done, not evidence of it: -verify answers "does this
 * change claim to be finished", and the review checkpoints judge whether it is.
 *
 * A root the caller named must exist. The default root may be absent — a project that has not yet
 * proposed a change has no `changes/` directory — and is then reported as "no active changes".
 */

import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"

import { count, TASKS_FILE } from "./tasks.ts"

/** Where changes live. Fixed by the workflow; see POLICY.md's "What is fixed, and not a slot". */
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
export async function scan(root: string, named = true): Promise<Change[]> {
  let entries

  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (err) {
    // An absent default root means the project has no changes yet; an absent named one is an error.
    if (!named && (err as { code?: string }).code === "ENOENT") return []

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

export const USAGE = "usage: changestat [-root <dir>] [-change <name>] [-verify]"

/** The flags that take a value, and the one that does not. */
const VALUED = new Set(["root", "change"])
const BOOLEAN = new Set(["verify"])

type Args = { root?: string; change?: string; verify: boolean }

/**
 * parse reads `-name value`, `-name=value` or `--name` forms.
 *
 * Anything it does not recognise is an error rather than ignored: an ignored `CHANGE=foo` reports
 * every change and, under a misspelt verify flag, exits 0 — a silent pass at the archive gate.
 */
export function parse(argv: string[]): Args {
  const args: Args = { verify: false }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const m = arg.match(/^--?([a-z]+)(?:=(.*))?$/)
    if (!m) throw new Error(`unexpected argument "${arg}"`)

    const [, name, inline] = m

    if (BOOLEAN.has(name!)) {
      if (inline !== undefined) throw new Error(`-${name} takes no value`)
      args.verify = true
      continue
    }

    if (!VALUED.has(name!)) throw new Error(`unknown flag "${arg}"`)

    const value = inline ?? argv[++i]
    if (value === undefined || value === "" || (inline === undefined && value.startsWith("-"))) {
      throw new Error(`-${name} needs a value`)
    }

    if (name === "root") args.root = value
    else args.change = value
  }

  return args
}

export async function main(argv: string[]): Promise<number> {
  let args: Args

  try {
    args = parse(argv)
  } catch (err) {
    console.error("changestat:", (err as Error).message)
    console.error(USAGE)

    return EXIT_ERROR
  }

  const root = args.root ?? DEFAULT_ROOT
  const name = args.change ?? ""
  const verify = args.verify

  let found: Change[]

  try {
    found = name !== "" ? await selected(root, name) : await scan(root, args.root !== undefined)
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
