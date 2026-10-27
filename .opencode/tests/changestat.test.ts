/**
 * changestat — tests for the workflow's task counter.
 *
 * `-verify`'s distinction between "work remains" (2) and "I could not look" (1) is what the archive
 * checkpoint acts on, so the process's exit codes are pinned as well as the counting.
 */

import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  ARCHIVE_DIR,
  COMPLETE,
  EXIT_ERROR,
  EXIT_UNMET,
  IN_PROGRESS,
  incomplete,
  main,
  parse,
  report,
  scan,
  selected,
} from "../workflow/changestat.ts"
import { TASKS_FILE } from "../workflow/tasks.ts"

function root(): string {
  return mkdtempSync(join(tmpdir(), "changestat-"))
}

/**
 * writeChange creates a change directory holding the given tasks.md body. `undefined` means the
 * change exists but has no tasks.md at all, which is a state -verify must refuse rather than read as
 * "nothing left to do".
 */
function writeChange(dir: string, name: string, body?: string) {
  const target = join(dir, name)
  mkdirSync(target, { recursive: true })

  if (body !== undefined) writeFileSync(join(target, TASKS_FILE), body)
}

describe("counting", () => {
  test("counts pending and completed tasks", async () => {
    const dir = root()
    writeChange(dir, "add-thing", "## 1. Group\n\n- [x] 1.1 done\n- [x] 1.2 also done\n- [ ] 1.3 pending\n")

    const got = await scan(dir)

    expect(got).toHaveLength(1)
    expect(got[0]!.done).toBe(2)
    expect(got[0]!.total).toBe(3)
  })

  test("indented, upper-cased and star-bulleted checkboxes are counted", async () => {
    // Every spelling appears in real task lists: an indented sub-item, [X] from an editor that
    // upper-cases it, and a star bullet. Missing any would silently undercount, which under -verify
    // reads as work that is not there.
    const dir = root()
    writeChange(dir, "add-thing", "- [X] 1.1 upper-cased\n  - [ ] 1.2 indented pending\n* [x] 1.3 star bullet\n")

    const got = await scan(dir)

    expect(got[0]!.done).toBe(2)
    expect(got[0]!.total).toBe(3)
  })

  test("non-checkbox lines are ignored", async () => {
    const dir = root()
    writeChange(
      dir,
      "add-thing",
      "## 1. Group\n\nProse mentioning - [ ] inline should not count.\n- a plain bullet\n- [ ] 1.1 real task\n",
    )

    const got = await scan(dir)

    expect(got[0]!.done).toBe(0)
    // Only a checkbox at the start of a line is a task.
    expect(got[0]!.total).toBe(1)
  })
})

describe("listing", () => {
  test("excludes the archive", async () => {
    const dir = root()
    writeChange(dir, "add-thing", "- [ ] 1.1 pending\n")
    writeChange(dir, join(ARCHIVE_DIR, "2026-01-01-old"), "- [x] 1.1 done\n")

    const got = await scan(dir)

    // An archived change is complete by definition and is not in flight.
    expect(got).toHaveLength(1)
    expect(got[0]!.name).toBe("add-thing")
  })

  test("reports every active change ordered by name", async () => {
    const dir = root()
    writeChange(dir, "zebra", "- [ ] 1.1 pending\n")
    writeChange(dir, "alpha", "- [x] 1.1 done\n")

    const got = await scan(dir)

    expect(got).toHaveLength(2)
    // Output is ordered so it is diffable.
    expect(got.map((c) => c.name)).toEqual(["alpha", "zebra"])
  })

  test("a missing named root is an error, not an empty report", async () => {
    // "no active changes" and "you pointed me at the wrong directory" must not print the same
    // thing, because the first is the answer a caller acts on.
    const missing = join(root(), "nope")

    await expect(scan(missing)).rejects.toThrow("nope")
  })

  test("a missing default root is no active changes, not an error", async () => {
    /*
     * A project that has not started using the workflow has no changes/ directory, and every skill
     * runs the counter at step 1 — so erroring here would make the first /wf-propose fail before it
     * could create the directory.
     *
     * Fails without the `named` parameter's ENOENT branch: throws, and main returns EXIT_ERROR.
     */
    expect(await scan(join(root(), "nope"), false)).toEqual([])
    expect(await main([])).toBe(0)
  })

  test("a change without tasks.md is reported rather than dropped", async () => {
    const dir = root()
    writeChange(dir, "no-tasks")

    // One unreadable change must not hide the others.
    const got = await scan(dir)

    expect(got).toHaveLength(1)
    expect(got[0]!.error).toBeDefined()
    expect(report(got)).toContain(`no ${TASKS_FILE}`)
  })

  test("an empty root reports no active changes", async () => {
    const got = await scan(root())

    expect(got).toHaveLength(0)
    expect(report(got)).toContain("no active changes")
  })
})

describe("verify", () => {
  test("fails while tasks remain", async () => {
    const dir = root()
    writeChange(dir, "add-thing", "- [x] 1.1 done\n- [ ] 1.2 pending\n")

    expect(incomplete(await scan(dir))).not.toBeEmpty()
  })

  test("fails for a change without tasks.md", async () => {
    const dir = root()
    writeChange(dir, "no-tasks")

    // A change with no task list has not been shown to be complete.
    expect(incomplete(await scan(dir))).not.toBeEmpty()
  })

  test("passes when every task is done", async () => {
    const dir = root()
    writeChange(dir, "add-thing", "- [x] 1.1 done\n- [X] 1.2 done\n")

    expect(incomplete(await scan(dir))).toBeEmpty()
  })
})

describe("selecting one change", () => {
  test("by name", async () => {
    const dir = root()
    writeChange(dir, "wanted", "- [ ] 1.1 pending\n")
    writeChange(dir, "other", "- [ ] 1.1 pending\n")

    const got = await selected(dir, "wanted")

    expect(got).toHaveLength(1)
    expect(got[0]!.name).toBe("wanted")
  })

  test("an archived change is nameable even though the listing excludes it", async () => {
    // The archive checkpoint verifies a change after it has been moved.
    const dir = root()
    const name = join(ARCHIVE_DIR, "2026-01-01-old")
    writeChange(dir, name, "- [x] 1.1 done\n")

    const got = await selected(dir, name)

    expect(got).toHaveLength(1)
    expect(incomplete(got)).toBeEmpty()
  })

  test("an unknown change is an error", async () => {
    await expect(selected(root(), "ghost")).rejects.toThrow("ghost")
  })
})

describe("report", () => {
  test("shows progress and state", async () => {
    const dir = root()
    writeChange(dir, "done-one", "- [x] 1.1 done\n")
    writeChange(dir, "busy-one", "- [x] 1.1 done\n- [ ] 1.2 pending\n")

    const out = report(await scan(dir))

    expect(out).toContain("1/2")
    expect(out).toContain("1/1")
    expect(out).toContain(COMPLETE)
    expect(out).toContain(IN_PROGRESS)
  })
})

describe("exit codes", () => {
  // 2 means work remains, 1 means the tool could not look. Collapsing them would make a mistyped
  // -root read as an unfinished change.

  test("a complete change verifies clean", async () => {
    const dir = root()
    writeChange(dir, "add-thing", "- [x] 1.1 done\n")

    expect(await main([`-root=${dir}`, "-verify"])).toBe(0)
  })

  test("an outstanding task exits 2", async () => {
    const dir = root()
    writeChange(dir, "add-thing", "- [ ] 1.1 pending\n")

    // Fails without the EXIT_UNMET branch in main: returns 0 and the archive gate opens.
    expect(await main([`-root=${dir}`, "-verify"])).toBe(EXIT_UNMET)
  })

  test("an unreadable root exits 1, distinct from unmet work", async () => {
    // Fails if the scan error is swallowed into an empty report: returns 0 and a mistyped path
    // reads as "no active changes".
    expect(await main([`-root=${join(root(), "nope")}`])).toBe(EXIT_ERROR)
    expect(EXIT_ERROR).not.toBe(EXIT_UNMET)
  })

  test("without -verify, outstanding work still exits 0", async () => {
    const dir = root()
    writeChange(dir, "add-thing", "- [ ] 1.1 pending\n")

    expect(await main([`-root=${dir}`])).toBe(0)
  })

  test("-change selects one change and -root takes a space-separated value", async () => {
    const dir = root()
    writeChange(dir, "wanted", "- [ ] 1.1 pending\n")
    writeChange(dir, "other", "- [x] 1.1 done\n")

    expect(await main(["-root", dir, "-change", "other", "-verify"])).toBe(0)
    expect(await main(["-root", dir, "-change", "wanted", "-verify"])).toBe(EXIT_UNMET)
  })
})

describe("arguments", () => {
  test("make-style assignments are refused, not ignored", async () => {
    const dir = root()
    writeChange(dir, "wanted", "- [ ] 1.1 pending\n")

    // Fails without the `unexpected argument` throw in parse: CHANGE= and VERIFY= are skipped, every
    // change is listed, verify is off, and main returns 0 with a task outstanding.
    expect(await main([`-root=${dir}`, "CHANGE=wanted", "VERIFY=1"])).toBe(EXIT_ERROR)
  })

  test("an unknown flag is refused", async () => {
    // Fails without the `unknown flag` throw in parse: a misspelt -verfiy is dropped and exits 0.
    expect(await main(["-verfiy"])).toBe(EXIT_ERROR)
  })

  test("a valued flag with no value is refused", () => {
    // Fails without the `needs a value` throw: -change followed by -verify swallows the flag.
    expect(() => parse(["-change", "-verify"])).toThrow("needs a value")
    expect(() => parse(["-change"])).toThrow("needs a value")
    expect(() => parse(["-root="])).toThrow("needs a value")
  })

  test("every accepted form parses", () => {
    expect(parse(["--root=r", "-change", "c", "--verify"])).toEqual({ root: "r", change: "c", verify: true })
    expect(parse([])).toEqual({ verify: false })
  })
})
