/**
 * self-contained — fail when the workflow bundle depends on something it does not carry.
 *
 * The bundle is copied into projects of any stack, so every project-specific command or path must
 * arrive through a `{slot}` declared in `PROJECT.template.md` and resolved by that project's own
 * `PROJECT.md`. A hardcoded `make frobnicate` works in the project it was written in and fails only
 * in the one that copies the bundle, where nobody is watching — so this is the check.
 *
 * It **derives its own scope** — globbing the skills, commands and workflow docs rather than naming
 * them — so a file added later is covered the moment it exists.
 *
 * # What it asserts
 *
 * 1. Every skill opens by pointing at `POLICY.md`, `PROJECT.md` and the bootstrap.
 * 2. Every `{slot}` used in the bundle is declared in `PROJECT.template.md`.
 * 3. A project's `PROJECT.md`, where present, declares no slot the template lacks.
 * 4. No backticked shell command in the bundle names a runner outside the bundle's own.
 * 5. No backticked path in the bundle names a host-project file.
 * 6. The template declares the slots `POLICY.md` calls required.
 * 7. No file in the bundle — including its own tests — reads a path outside `.opencode/`.
 * 8. No portable prose file narrates the history of the project the bundle was written in.
 * 9. Every stage skill ends with a hand-off, and the stage agent cannot ask the user anything.
 *
 * # What it deliberately does not assert
 *
 * That a declared command *exists*. That is the project's business, and running the project's build
 * from here would make this suite non-hermetic. Nor does it read `PROJECT.md` for anything it needs:
 * the suite must pass in a project that has not been bootstrapped yet.
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
const PROJECT = join(WORKFLOW, "PROJECT.md")

/** A `{slot}` reference. Lower-case and hyphens only, so `{}` in a code sample is not one. */
const SLOT = /\{([a-z][a-z-]*)\}/g

/** Placeholders that explain the notation rather than name a slot. */
const NOTATIONAL = new Set(["slot", "gate", "name", "what", "n", "x"])

/** Only spans inside backticks are checked, so ordinary prose is never mistaken for a citation. */
const BACKTICKED = /`([^`\n]+)`/g

/**
 * The runners a backticked command may name: `git` for the checkpoints, `bun` because it is the
 * bundle's own interpreter, and the shell builtins `INSTALL.md` uses to copy it. Anything else must
 * arrive through a slot.
 */
const ALLOWED_RUNNERS = new Set(["git", "bun", "cp", "mkdir", "cd", "rsync"])

/**
 * Anything that looks like a command invocation at the start of a backticked span. The trailing
 * `\s+\S` matters: several of these are ordinary words, and a runner with no argument is not an
 * invocation.
 */
const RUNNERS =
  /^(make|npm|npx|yarn|pnpm|go|cargo|mvn|gradle|pytest|python|python3|ruby|rake|dotnet|swift|bundle|tox|nox|just|task|mix|sbt|composer|deno|node|tsc|eslint|ruff|black|gofmt|golangci-lint)\s+\S/

/**
 * Paths the workflow owns, so citing one is not a host-project dependency: `POLICY.md`'s "What is
 * fixed, and not a slot" table, the files bootstrap creates, and the bundle's own files. Listed
 * rather than derived, so adding a row to POLICY.md cannot make this test pass.
 */
const WORKFLOW_OWNED = [
  "changes/",
  "archive/",
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
  "PROJECT.template.md",
  "INSTALL.md",
  "SKILL.md",
  "tasks.ts",
  "changestat.ts",
  "README.template.md",
  "0001-template.md",
  "NNNN-short-title.md",
  "0001-record-architecture-decisions.md",
  "invariants.template.md",
  "report.md",
  "report.template.md",
  "wf-stage.md",
  "self-contained.test.ts",
]

function read(path: string): string {
  return readFileSync(path, "utf8")
}

/** skills globs the skill files rather than listing them, so a new skill cannot escape this suite. */
function skills(): { name: string; body: string }[] {
  return readdirSync(SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("wf-"))
    .map((e) => ({ name: e.name, body: read(join(SKILLS, e.name, "SKILL.md")) }))
}

/** markdown lists the `.md` files in a directory, recursively, by path relative to the bundle. */
function markdown(dir: string, prefix: string): { name: string; body: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return markdown(join(dir, e.name), `${prefix}/${e.name}`)
    if (!e.name.endsWith(".md")) return []

    return [{ name: `${prefix}/${e.name}`, body: read(join(dir, e.name)) }]
  })
}

/**
 * files is every portable prose file in the bundle. `PROJECT.md` is excluded: it is the one file
 * whose job is to name the host project's commands and paths.
 */
function files(): { name: string; body: string }[] {
  return [
    ...skills().map((s) => ({ name: `skills/${s.name}/SKILL.md`, body: s.body })),
    ...markdown(COMMANDS, "commands").filter((f) => f.name.match(/\/wf-[^/]+\.md$/)),
    ...markdown(join(BUNDLE, "agents"), "agents").filter((f) => f.name.match(/\/wf-[^/]+\.md$/)),
    ...markdown(WORKFLOW, "workflow").filter((f) => f.name !== "workflow/PROJECT.md"),
  ]
}

/** slots reads the slot names a file mentions. */
function slots(body: string): Set<string> {
  return new Set([...body.matchAll(SLOT)].map(([, n]) => n!))
}

/**
 * declared reads the slots a file defines: the first cell of a table row. A slot merely mentioned in
 * prose is not declared, or deleting a row would go unnoticed wherever the prose names it too.
 */
function declared(body: string): Set<string> {
  return new Set([...body.matchAll(/^\| `\{([a-z][a-z-]*)\}` \|/gm)].map(([, n]) => n!))
}

describe("every skill opens by pointing at the policy and the bootstrap", () => {
  const PREAMBLE = "> **Read `.opencode/workflow/POLICY.md` and `.opencode/workflow/PROJECT.md` first.**"

  for (const s of skills()) {
    test(s.name, () => {
      // Fails when the preamble is reworded or moved out of the opening block: the skills cite
      // POLICY.md further down too, so a bare "mentions it" check passes with the preamble deleted.
      expect(s.body).toContain(PREAMBLE)

      const frontmatterEnd = s.body.indexOf("---", s.body.indexOf("---") + 3)
      const start = s.body.indexOf(PREAMBLE)
      expect(start - frontmatterEnd).toBeLessThan(400)

      // Fails when the bootstrap sentence is dropped from the preamble: a fresh project then runs a
      // step against an absent or foreign PROJECT.md.
      const block = s.body.slice(start, s.body.indexOf("\n\n", start))
      expect(block).toContain('"Bootstrap"')
    })
  }
})

describe("every slot used is declared in PROJECT.template.md", () => {
  const known = declared(read(TEMPLATE))

  for (const f of files()) {
    test(f.name, () => {
      const undeclared = [...slots(f.body)].filter((n) => !known.has(n) && !NOTATIONAL.has(n))

      // Fails when a skill invents a slot: plant `{deploy}` in any skill and this reports it.
      expect(undeclared).toEqual([])
    })
  }
})

describe("a bootstrapped PROJECT.md declares only template slots", () => {
  // Skipped rather than failed when absent: the suite must pass before bootstrap has run.
  test.skipIf(!existsSync(PROJECT))("PROJECT.md", () => {
    const known = declared(read(TEMPLATE))
    const extra = [...declared(read(PROJECT))].filter((n) => !known.has(n) && !NOTATIONAL.has(n))

    // Fails when PROJECT.md keeps a slot the template retired: plant `{changes}` and this reports it.
    expect(extra).toEqual([])
  })
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

describe("no portable file narrates the history of the project it came from", () => {
  /*
   * A rule justified by an anecdote from the project the bundle was written in cites nothing the
   * reader of a copy can look up. These phrases mark that narration: a reference to the source
   * project, to a rule's previous wording, or to a specific review-fix task by its identifier. A
   * rule may still give a general reason; it may not tell the story of how it was arrived at.
   */
  const NARRATION = [
    /originating (repository|project)/i,
    /this workflow was developed in/i,
    /\bthe earlier (rule|wording|form)\b/i,
    /\bthe rule (this|they) replaces?\b/i,
    /\bused to (be|get|carry|demand|make)\b/i,
    /\bin the session this\b/i,
    /\bR\d+\.\d+\b/,
  ]

  for (const f of files()) {
    test(f.name, () => {
      const found = NARRATION.flatMap((re) => f.body.match(re)?.[0] ?? [])

      // Fails when narration comes back: planting "In the originating repository, …" in POLICY.md
      // turns this test red for that file.
      expect(found).toEqual([])
    })
  }
})

describe("the flow between stages", () => {
  /** The skills that are not stages: one is a conversation, the other runs the stages. */
  const NOT_STAGES = new Set(["wf-explore", "wf-flow"])
  const STAGE_AGENT = join(BUNDLE, "agents", "wf-stage.md")

  for (const s of skills().filter((s) => !NOT_STAGES.has(s.name))) {
    test(`${s.name} ends with a hand-off`, () => {
      // Fails when a stage skill loses its "## Hand-off" section, or it stops being the last one:
      // the orchestrator then gets no next stage and the flow halts after it.
      const at = s.body.lastIndexOf("\n## Hand-off\n")
      expect(at).toBeGreaterThan(0)
      expect(s.body.slice(at + 1).match(/^## /gm)).toHaveLength(1)
      expect(s.body.slice(at)).toContain("`stop: needs-input`")
    })
  }

  test("the stage agent denies the question tool and allows todowrite", () => {
    // Fails without `question: deny`: a stage could then ask from inside a subagent, where the
    // orchestrator cannot see the question. Fails without `todowrite: allow`: the implement stage
    // loses its task mirror.
    const front = read(STAGE_AGENT).split("---")[1]!

    expect(front).toMatch(/^mode: subagent$/m)
    expect(front).toMatch(/^  question: deny$/m)
    expect(front).toMatch(/^  todowrite: allow$/m)
  })

  test("wf-flow launches the stage agent, and every stage command runs wf-flow", () => {
    // Fails when a command goes back to loading its skill directly, which runs that stage in the
    // main session and ends the flow after it.
    expect(read(join(SKILLS, "wf-flow", "SKILL.md"))).toContain('subagent_type: "wf-stage"')

    const commands = markdown(COMMANDS, "commands").filter(
      (f) => f.name.match(/\/wf-[^/]+\.md$/) && !f.name.endsWith("/wf-explore.md"),
    )
    expect(commands.length).toBeGreaterThanOrEqual(7)
    for (const c of commands) expect([c.name, c.body.includes("load `wf-flow`")]).toEqual([c.name, true])
  })
})

describe("PROJECT.template.md declares what POLICY.md requires", () => {
  const required = ["format", "lint", "test", "production-roots", "test-patterns"]

  test("the required slots are all present", () => {
    // Fails when a required row is deleted from the template: bootstrap then never asks for it.
    expect(required.filter((slot) => !declared(read(TEMPLATE)).has(slot))).toEqual([])
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
      for (const entry of readdirSync(join(BUNDLE, sub))) {
        if (!entry.endsWith(".ts")) continue

        out.push({ name: `${sub}/${entry}`, body: read(join(BUNDLE, sub, entry)) })
      }
    }

    return out
  }

  for (const f of sources()) {
    test(f.name, () => {
      // Fails when a fixture reaches into the host project: add a `"../../changes/x/tasks.md"` read
      // to any test and this reports it.
      expect([...code(f.body).matchAll(ESCAPING)].map(([m]) => m)).toEqual([])
    })
  }

  test("it is looking at the files it claims to", () => {
    // A suite that globbed nothing would pass every assertion above vacuously.
    expect(sources().length).toBeGreaterThanOrEqual(5)
    expect(files().length).toBeGreaterThanOrEqual(15)
  })
})
