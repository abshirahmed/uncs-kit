# CLAUDE.md

Instructions for Claude Code when working in the scripts folder.

## Overview

Generic CLI tools for development workflows, located at `~/.scripts/`. See [README.md](./README.md) for full usage documentation.

## Location

These scripts live in `~/.scripts/` (global, not tied to any project).

## Quick Reference

```bash
bun install                                    # Install deps

# Pull repos (works on any directory of repos)
pull-all                                       # Pull repos in current directory
pull-all ~/projects/foo                        # Pull repos in specified directory
pull-all --dry-run                             # Preview only
pull-all --all                                 # Pull all regardless of branch

# Jira
jira get PAD-123                               # Fetch issue
jira search "project = PAD"                    # Search with JQL
jira create -p PAD -t Bug -s "Title" -d ./report.md
jira update PAD-123 -s "New title" -P High

# Confluence
confluence get 123456789                       # Fetch page
confluence search "query"                      # Search pages
confluence create -s SPACE -t "Title" --body-text "<p>Content</p>"
```

## Adding Scripts

1. Create `my-script.ts` in scripts root
2. Use `commander` for CLI, `lib/logger.ts` for TUI output
3. Add reusable logic to `lib/`
4. Update README.md

## Environment

Requires in `~/.zshrc`:
```bash
# Atlassian (one token for both Jira and Confluence)
export ATLASSIAN_SITE="your-site.atlassian.net"
export ATLASSIAN_EMAIL="you@example.com"
export ATLASSIAN_API_TOKEN="your-token"  # https://id.atlassian.com/manage-profile/security/api-tokens

# Dev scripts
alias pull-all="bun ~/.scripts/pull-all.ts"
alias jira="bun ~/.scripts/jira.ts"
alias confluence="bun ~/.scripts/confluence.ts"
```
