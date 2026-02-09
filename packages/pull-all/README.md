# @uncskit/pull-all

You've got 30 repos. You're not going to `cd` into each one. This tool pulls all git repos in a directory in parallel, with smart branch handling — repos on `main` get pulled, repos on feature branches get `main` fetched so your local main stays current without switching branches.

## Install

```bash
bun install -g @uncskit/pull-all
```

Or run directly from the monorepo:

```bash
bun packages/pull-all/src/cli.ts
```

## Usage

```bash
# Pull repos in current directory
pull-all

# Pull repos in a specific directory
pull-all ~/projects

# Preview what would happen
pull-all --dry-run

# Pull everything regardless of branch
pull-all --all

# Machine-readable output
pull-all --json
```

If you run it inside a git repo (not a directory of repos), it pulls that single repo.

## How it works

1. **Scans** the target directory for git repos
2. **Repos on main/master** — runs `git pull`
3. **Repos on feature branches** — runs `git fetch origin main:main` to update your local main without switching branches
4. **Parallel execution** — all repos are processed concurrently
5. **Summary table** — shows what was updated, fetched, or failed

## Options

| Flag | Description |
|---|---|
| `-d, --dry-run` | Show what would be pulled without pulling |
| `-a, --all` | Pull all repos regardless of branch |
| `-j, --json` | Output as JSON |
| `-V, --version` | Show version |

## License

[MIT](../../LICENSE)
