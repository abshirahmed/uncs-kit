# CLAUDE.md

Instructions for Claude Code when working in the uncs-kit monorepo.

## Overview

`uncs-kit` is a Bun workspaces monorepo containing CLI tools for development workflows, published under the `@uncskit` npm scope. See [README.md](./README.md) for full usage documentation.

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
pull-all                                       # Pull repos in current directory
pull-all ~/projects                            # Pull repos in specified directory
pull-all --dry-run                             # Preview only

# Jira
jira get PAD-123                               # Fetch issue
jira search "project = PAD"                    # Search with JQL
jira create -p PAD -t Bug -s "Title" -d ./report.md

# Confluence
confluence get 123456789                       # Fetch page
confluence search "query"                      # Search pages

# Download Confluence
download-confluence search "query" -o ./output/
```

## Adding New Packages

1. Create `packages/my-package/` with `package.json`, `tsconfig.json`, and `src/`
2. Add `@uncskit/shared` as a dependency if you need logger/markdown utils
3. Use `commander` for CLI, `@uncskit/shared` for TUI output
4. Run `bun install` to link the workspace
5. Add `bun link` for the package to the root `postinstall` script
6. Run `bun install` to link everything
7. Add a `README.md` to the package

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

# Binaries (pull-all, jira, confluence, download-confluence) are
# auto-linked to ~/.bun/bin/ via postinstall — just run `bun install`
```
