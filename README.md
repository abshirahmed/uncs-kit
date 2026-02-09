# @uncskit

Dev tools that do the boring stuff so you don't have to.

CLI tools for git workflows and Atlassian (Jira + Confluence) — built for developers who'd rather write code than click through web UIs.

![pull-all demo](tapes/output/pull-all.gif)

## What's in the box

| Package | What it does |
|---|---|
| [`@uncskit/pull-all`](./packages/pull-all/) | Update all your git repos in one command. Pulls main, fetches main for feature branches. |
| [`@uncskit/atlassian-cli`](./packages/atlassian-cli/) | Jira and Confluence from the terminal. Create issues from markdown, download pages for AI context. |
| `@uncskit/shared` | Internal utilities — logger, markdown converter. You won't install this directly. |

## Prerequisites

[Bun](https://bun.sh) v1.0+

```bash
curl -fsSL https://bun.sh/install | bash   # macOS / Linux
powershell -c "irm bun.sh/install.ps1 | iex"  # Windows
brew install oven-sh/bun/bun               # Homebrew
mise use -g bun@latest                     # mise
```

## Getting started

```bash
git clone git@github.com:abshirahmed/uncs-kit.git
cd uncs-kit
bun install
bun run setup
```

That's it. `bun run setup` creates shim scripts in `~/.local/bin/` so `pull-all`, `jira`, `confluence`, and `download-confluence` work anywhere. If that directory isn't in your PATH, the script tells you what to add.

To remove the shims later: `bun run setup --uninstall`

## Quick taste

```bash
# Update every repo in your projects folder
pull-all ~/projects

# Grab a Jira issue
jira get PAD-123

# Create a bug from a markdown file
jira create -p PAD -t Bug -s "Auth failure on login" -d ./report.md

# Search Confluence and download matching pages as markdown
download-confluence search "onboarding flow" -o ./.context/
```

All commands support `--json` for machine-readable output and `--help` for full options.

<details>
<summary><strong>jira</strong></summary>

![jira demo](tapes/output/jira.gif)

</details>

<details>
<summary><strong>confluence</strong></summary>

![confluence demo](tapes/output/confluence.gif)

</details>

<details>
<summary><strong>download-confluence</strong></summary>

![download-confluence demo](tapes/output/download-confluence.gif)

</details>

For Atlassian tools, you'll need API credentials — see the [atlassian-cli README](./packages/atlassian-cli/).

## License

[MIT](./LICENSE)
