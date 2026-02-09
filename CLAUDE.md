# CLAUDE.md

Instructions for Claude Code when working in the uncs-kit monorepo.

## Overview

`uncs-kit` is a Bun workspaces monorepo containing CLI tools for development workflows, published under the `@uncskit` npm scope. See [README.md](./README.md) for full usage documentation.

## Location

This repo lives at `~/.scripts/` (global, not tied to any project).

## Monorepo Structure

```
uncs-kit/
├── packages/
│   ├── shared/          # @uncskit/shared — logger, markdown utils (internal)
│   ├── pull-all/        # @uncskit/pull-all — git multi-repo updater
│   └── atlassian-cli/   # @uncskit/atlassian-cli — jira + confluence CLIs
├── package.json         # workspace root
└── tsconfig.json        # base TypeScript config
```

## Quick Reference

```bash
bun install                                    # Install all workspace deps

# Pull repos
bun packages/pull-all/src/cli.ts               # Pull repos in current directory
bun packages/pull-all/src/cli.ts ~/projects    # Pull repos in specified directory
bun packages/pull-all/src/cli.ts --dry-run     # Preview only

# Jira
bun packages/atlassian-cli/src/jira.ts get PAD-123
bun packages/atlassian-cli/src/jira.ts search "project = PAD"
bun packages/atlassian-cli/src/jira.ts create -p PAD -t Bug -s "Title" -d ./report.md

# Confluence
bun packages/atlassian-cli/src/confluence.ts get 123456789
bun packages/atlassian-cli/src/confluence.ts search "query"

# Download Confluence
bun packages/atlassian-cli/src/download-confluence.ts search "query" -o ./output/
```

## Adding New Packages

1. Create `packages/my-package/` with `package.json`, `tsconfig.json`, and `src/`
2. Add `@uncskit/shared` as a dependency if you need logger/markdown utils
3. Use `commander` for CLI, `@uncskit/shared` for TUI output
4. Run `bun install` to link the workspace
5. Add a `README.md` to the package

## Adding Code to Existing Packages

- CLI entry points go in `packages/<name>/src/`
- Reusable logic goes in `packages/<name>/src/lib/`
- Shared utilities (logger, markdown) go in `packages/shared/src/`

## Environment

Requires in `~/.zshrc`:
```bash
# Atlassian (one token for both Jira and Confluence)
export ATLASSIAN_SITE="your-site.atlassian.net"
export ATLASSIAN_EMAIL="you@example.com"
export ATLASSIAN_API_TOKEN="your-token"

# Optional: custom Jira story points field (default: customfield_10031)
export JIRA_STORY_POINTS_FIELD="customfield_10031"

# Dev scripts aliases
alias pull-all="bun ~/.scripts/packages/pull-all/src/cli.ts"
alias jira="bun ~/.scripts/packages/atlassian-cli/src/jira.ts"
alias confluence="bun ~/.scripts/packages/atlassian-cli/src/confluence.ts"
alias download-confluence="bun ~/.scripts/packages/atlassian-cli/src/download-confluence.ts"
```
