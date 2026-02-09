# @uncskit

Dev tools that do the boring stuff so you don't have to.

A Bun workspaces monorepo with CLI tools for git workflows and Atlassian (Jira + Confluence). Built for developers who'd rather spend their time writing code than clicking through web UIs.

## What's in the box

| Package | What it does |
|---|---|
| [`@uncskit/pull-all`](./packages/pull-all/) | Update all your git repos in one command. Smart branch handling — pulls main, fetches main for feature branches. |
| [`@uncskit/atlassian-cli`](./packages/atlassian-cli/) | Jira and Confluence from the terminal. Create issues from markdown, download Confluence pages for AI context. |
| `@uncskit/shared` | Internal utilities — logger, markdown converter. You won't install this directly. |

## Prerequisites

- [Bun](https://bun.sh) v1.0+

## Quick start

```bash
git clone git@github.com:abshirahmed/uncs-kit.git ~/.scripts
cd ~/.scripts
bun install

# Link binaries globally (adds pull-all, jira, confluence, download-confluence to PATH)
cd packages/pull-all && bun link && cd ../..
cd packages/atlassian-cli && bun link && cd ../..
```

That's it. The commands are now available everywhere — no aliases needed.

For Atlassian tools, you'll also need API credentials — see the [atlassian-cli README](./packages/atlassian-cli/).

## License

[MIT](./LICENSE)
