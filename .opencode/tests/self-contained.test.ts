/**
 * self-contained — fail when the workflow bundle depends on something it does not carry.
 *
 * The bundle was made portable once, by hand: 36 citations of the host project's own standards, a
 * task counter that needed a Go toolchain, and a write-scope rule spelled as "no Go statement
 * outside a `_test.go` file" all became `{slot}` names resolved through `PROJECT.md`. Nothing
 * stopped the next edit undoing that. A skill is prose, `POLICY.md`'s own direct-commit rule means
 * no review round looks at it, and a reintroduced `make frobnicate` works perfectly in the
 * repository it was written in — the failure only appears in the project that copies the bundle,
 * where nobody is watching.
 *
 * So this is the check that replaces the round. It **derives its own scope** — globbing the skills
 * rather than naming them — so an eighth skill is covered the moment it exists, per `POLICY.md`'s
 * preference for a test that cannot be escaped by a member added later.
 *
 * # What it asserts
 *
 * 1. Every skill points the reader at `POLICY.md` and `PROJECT.md`.
 * 2. Every `{slot}` used anywhere in the bundle is declared in `PROJECT.template.md`.
 * 3. No backticked shell command in the bundle names a runner that `PROJECT.md` does not declare.
 * 4. No path-like citation outside `PROJECT.md` names a host-project file.
 * 5. `PROJECT.template.md` declares the slots `POLICY.md` calls required.
 * 6. No file in the bundle — **including its own tests** — reads a path outside `.opencode/`.
 *
 * # What it deliberately does not assert
 *
 * That a declared command *exists*. `PROJECT.md` naming `make frobnicate` is a project's problem
 * and the workflow's business is only that the citation is declared rather than hardcoded. Running
 * the project's build from the bundle's test suite would also make this test non-hermetic, which is
 * the one thing a portability check cannot afford.
 */

import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const BUNDLE = join(import.meta.dir, "..")
/**
 * The skills and the commands sit at the root of this repository and under `.opencode/` once
 * installed, so each is resolved wherever it is rather than assumed.
 */
function bundleDir(name: string): string {
  const inner = join(BUNDLE, name)

  return existsSync(inner) ? inner : join(BUNDLE, "..", name)
}

const SKILLS = bundleDir("skills")
const COMMANDS = bundleDir("commands")
const WORKFLOW = join(BUNDLE, "workflow")
const TEMPLATE = join(WORKFLOW, "PROJECT.template.md")

/** A `{slot}` reference. Lower-case and hyphens only, so `{}` in a code sample is not one. */
const SLOT = /\{([a-z][a-z-]*)\}/g

/**
 * A path-like citation: two segments joined by a slash, or a bare Markdown/config filename.
 *
 * Only matched inside backticks, because prose says "under app/src/" in sentences that are about
 * the originating repository by design, and a rule that could not tell those apart would have to be
 * suppressed so often it would stop being read.
 */
const BACKTICKED = /`([^`\n]+)`/g

/**
 * The runners a backticked command may name.
 *
 * `git` because the checkpoints are git commits and always will be; `bun` because it is the
 * bundle's own interpreter and `INSTALL.md` names it; `cp` and `mkdir` because `INSTALL.md` gives
 * copy instructions. Everything else — a build tool, a test runner, a linter — must arrive through
 * a slot, because that is the whole point.
 */
const ALLOWED_RUNNERS = new Set(["git", "bun", "cp", "mkdir", "cd"])

/**
 * Anything that looks like a command invocation at the start of a backticked span.
 *
 * The trailing `\s+\S` is load-bearing: several of these words are also ordinary English, and a
 * runner with no argument is not an invocation. Without it, `task` — the name of one of this
 * workflow's three finding dispositions — reads as the `task` build tool, and the rule fires on
 * prose it has no business touching.
 */
const RUNNERS =
  /^(make|npm|npx|yarn|pnpm|go|cargo|mvn|gradle|pytest|python|python3|ruby|rake|dotnet|swift|bundle|tox|nox|just|task|mix|sbt|composer|deno|node|tsc|eslint|ruff|black|gofmt|golangci-lint)\s+\S/

/**
 * Paths the workflow owns, so a citation of one is not a host-project dependency.
 *
 * These are `POLICY.md`'s "What is fixed, and not a slot" table plus the bundle's own files. Kept
 * here rather than derived, because deriving them from `POLICY.md`'s table would make this test
 * pass whenever somebody added a row to it.
 */
const WORKFLOW_OWNED = [
  "changes/",
  "archive/",
  // The retired spec corpus. POLICY.md owns the statement that this directory does not exist, and a
  // citation of a thing required to be absent is not a dependency on it.
  "specs/",
  "proposal.md",
  "design.md",
  "tasks.md",
  "review.md",
  "test_plan.md",
  ".opencode/",
  "skills/",
  "commands/",
  "POLICY.md",
  "PROJECT.md",
  "INSTALL.md",
  "SKILL.md",
  "tasks.ts",
  "changestat.ts",
  "README.template.md",
  "0001-template.md",
  "self-contained.test.ts",
]

function read(path: string): string {
  return readFileSync(path, "utf8")
}

/** skills globs the skill files rather than listing them, so a new skill cannot escape this suite. */
function skills(): { name: string; path: string; body: string }[] {
  return readdirSync(SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("wf-"))
    .map((e) => ({
      name: e.name,
      path: join(SKILLS, e.name, "SKILL.md"),
      body: read(join(SKILLS, e.name, "SKILL.md")),
    }))
}

/** files is every prose file in the bundle that may cite a command or a path. */
function files(): { name: string; body: string }[] {
  const commands = COMMANDS

  return [
    ...skills().map((s) => ({ name: `skills/${s.name}/SKILL.md`, body: s.body })),
    ...readdirSync(commands)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ name: `commands/${f}`, body: read(join(commands, f)) })),
    { name: "workflow/POLICY.md", body: read(join(WORKFLOW, "POLICY.md")) },
  ]
}

/** declared reads the slot names the template defines, from the `{name}` in its own tables. */
function declared(): Set<string> {
  const body = read(TEMPLATE)
  const found = new Set<string>()

  for (const [, name] of body.matchAll(SLOT)) found.add(name!)

  return found
}

describe("every skill opens by pointing at the policy", () => {
  /*
   * The **preamble**, not merely a mention. A first draft of this asserted that the body contained
   * the string ".opencode/workflow/POLICY.md" anywhere, and it passed with the preamble deleted —
   * because the skills cite POLICY.md a dozen times further down. That is the vacuous guard
   * POLICY.md's own review rules exist to catch, found here by mutation rather than by reading.
   *
   * It has to be the opening block, because that is the only position that is read before the skill
   * starts issuing instructions that assume a resolved slot.
   */
  const PREAMBLE = "> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.**"

  for (const s of skills()) {
    test(s.name, () => {
      // Fails when the preamble is reworded or moved out of the opening block.
      expect(s.body).toContain(PREAMBLE)

      const frontmatterEnd = s.body.indexOf("---", s.body.indexOf("---") + 3)
      expect(s.body.indexOf(PREAMBLE) - frontmatterEnd).toBeLessThan(400)
    })
  }
})

describe("every slot used is declared in PROJECT.template.md", () => {
  const known = declared()

  // `{slot}` is the literal placeholder the preamble uses to explain the notation.
  const notational = new Set(["slot", "gate", "name", "what", "n", "x"])

  for (const f of files()) {
    test(f.name, () => {
      const used = new Set([...f.body.matchAll(SLOT)].map(([, n]) => n!))
      const undeclared = [...used].filter((n) => !known.has(n) && !notational.has(n))

      // Fails when a skill invents a slot: plant `{deploy}` in any skill and this reports it.
      expect(undeclared).toEqual([])
    })
  }
})

describe("no backticked command names an undeclared runner", () => {
  for (const f of files()) {
    test(f.name, () => {
      const offending: string[] = []

      for (const [, span] of f.body.matchAll(BACKTICKED)) {
        const text = span!.trim()

        if (!RUNNERS.test(text)) continue
        if (ALLOWED_RUNNERS.has(text.split(/\s+/)[0]!)) continue

        offending.push(text)
      }

      // Fails when a hardcoded command comes back: plant `make frobnicate` and this reports it.
      expect(offending).toEqual([])
    })
  }
})

describe("no backticked path names a host-project file", () => {
  for (const f of files()) {
    test(f.name, () => {
      const offending: string[] = []

      for (const [, span] of f.body.matchAll(BACKTICKED)) {
        const text = span!.trim()

        // A path-like citation: has a slash with a name either side, or ends in a doc extension.
        const looksLikePath = /^[\w.@-]+\/[\w./*-]*$/.test(text) || /^[\w.-]+\.(md|toml|ya?ml|json)$/.test(text)
        if (!looksLikePath) continue
        if (WORKFLOW_OWNED.some((owned) => text.includes(owned))) continue

        offending.push(text)
      }

      // Fails when a host path comes back: plant `docs/adr/` in any skill and this reports it.
      expect(offending).toEqual([])
    })
  }
})

describe("PROJECT.template.md declares what POLICY.md requires", () => {
  // POLICY.md names these as required. A PROJECT.md missing one leaves a step with nothing to run
  // and no slot to report as skipped, which is the one degradation the design does not allow.
  const required = ["format", "lint", "test", "production-roots", "test-patterns"]

  test("the required slots are all present", () => {
    const known = declared()

    expect(required.filter((slot) => !known.has(slot))).toEqual([])
  })
})

describe("no bundle file reads a path outside .opencode/", () => {
  /*
   * `../` alone is fine (a plugin importing `../workflow/tasks.ts`); `../../` is not, because from
   * any file in the bundle that is the host project. A fixture read from there passes where it was
   * written and fails in every project that copies the bundle.
   */
  const ESCAPING = /["'`](\.\.\/){2,}[^"'`\n]*["'`]/g

  /** Comments are stripped first: a comment describing an escaping path is not a dependency on one. */
  function code(body: string): string {
    return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "")
  }

  function sources(): { name: string; body: string }[] {
    const out: { name: string; body: string }[] = []

    for (const sub of ["tests", "plugins", "workflow"]) {
      const dirPath = join(BUNDLE, sub)

      for (const entry of readdirSync(dirPath)) {
        if (!entry.endsWith(".ts")) continue

        out.push({ name: `${sub}/${entry}`, body: read(join(dirPath, entry)) })
      }
    }

    return out
  }

  for (const f of sources()) {
    test(f.name, () => {
      const escapes = [...code(f.body).matchAll(ESCAPING)].map(([m]) => m)

      // Fails when a fixture reaches into the host project: add a `"../../changes/x/tasks.md"` read
      // to any test and this reports it.
      expect(escapes).toEqual([])
    })
  }

  test("it is looking at the files it claims to", () => {
    // A suite that globbed nothing would pass every assertion above vacuously.
    expect(sources().length).toBeGreaterThanOrEqual(5)
  })
})
