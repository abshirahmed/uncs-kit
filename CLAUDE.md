# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`uncs-kit` is a Bun workspaces monorepo containing CLI tools for development workflows, published under the `@uncskit` npm scope. All packages run directly via `bun` (no build step, no transpilation).

## Commands

```bash
bun install              # Install all workspace deps
bun run setup            # Generate shim scripts in ~/.local/bin/ (links CLI binaries)
```

There is no build, lint, or test infrastructure. TypeScript is checked via `noEmit: true` in tsconfig — the project relies on Bun's native TS execution.

To run a CLI during development without the shim:
```bash
bun packages/pull-all/src/cli.ts [args]
bun packages/atlassian-cli/src/jira.ts [args]
bun packages/atlassian-cli/src/confluence.ts [args]
bun packages/atlassian-cli/src/download-confluence.ts [args]
```

## Architecture

### Monorepo Layout

```
packages/
├── shared/          # @uncskit/shared — internal TUI + markdown utilities
├── pull-all/        # @uncskit/pull-all — git multi-repo updater
└── atlassian-cli/   # @uncskit/atlassian-cli — jira, confluence, download-confluence CLIs
```

### Package Dependency Graph

```
pull-all ──→ shared
atlassian-cli ──→ shared
```

`shared` is the only internal dependency. All packages use `workspace:*` to reference it.

### Code Organization Pattern

Each CLI package follows the same structure:

- **`src/<name>.ts`** — CLI entry point using `commander`. Handles argument parsing, spinner/table output, and delegates to `lib/` functions.
- **`src/lib/<name>.ts`** — API client wrapper. Creates typed client instances, defines domain interfaces (`IssueInfo`, `PageInfo`, etc.), and exposes async functions that return clean domain objects.
- **`src/lib/atlassian.ts`** — Shared config loader for both Jira and Confluence (reads `ATLASSIAN_SITE`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` from env).

### Shared Package (`@uncskit/shared`)

Exports two modules via `src/index.ts`:

- **`logger.ts`** — `log` object (title, success, error, item, etc.), `spinner()`, `createTable()`, `summaryBox()`, `itemList()`. All CLIs use these for consistent terminal output.
- **`markdown.ts`** — `htmlToMarkdown()` (via node-html-markdown), `sanitizeFilename()`, `generateFrontmatter()`. Used by Confluence tools to convert HTML storage format to markdown files.

### Key Patterns

- **All CLIs support `--json` flag** — when set, suppress TUI output (no spinners/tables) and emit JSON to stdout. This pattern is consistent: check `options.json` before any `log.*` or `spinner()` call.
- **Jira uses markdown-to-ADF conversion** — `markdownToAdf()` in `lib/jira.ts` converts markdown descriptions to Atlassian Document Format when creating/updating issues. It handles headings, bullet lists, code blocks, inline code, bold, and links.
- **Parallel operations** — `pull-all` scans and pulls repos in parallel via `Promise.all`. It has a 3-phase approach: scan repos → pull main-branch repos → fetch main for feature-branch repos.
- **Shim-based binary linking** — `setup.ts` reads `bin` entries from each package's `package.json` and generates shell scripts in `~/.local/bin/` that `exec bun <path>`.

## Adding New Packages

1. Create `packages/my-package/` with `package.json`, `tsconfig.json`, and `src/`
2. Add `@uncskit/shared` as a `workspace:*` dependency if you need logger/markdown utils
3. Use `commander` for CLI argument parsing
4. Follow the CLI entry point + lib wrapper pattern
5. Run `bun install && bun run setup` to link the workspace and create shims

## Adding Code to Existing Packages

- CLI entry points: `packages/<name>/src/`
- API client wrappers and business logic: `packages/<name>/src/lib/`
- Shared TUI/markdown utilities: `packages/shared/src/`

## Environment Variables

Atlassian tools require:
```
ATLASSIAN_SITE=your-site.atlassian.net
ATLASSIAN_EMAIL=you@example.com
ATLASSIAN_API_TOKEN=<token>
```

Optional: `JIRA_STORY_POINTS_FIELD` (default: `customfield_10031`)
