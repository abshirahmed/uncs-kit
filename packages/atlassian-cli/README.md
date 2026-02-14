# @uncskit/atlassian-cli

Jira and Confluence from your terminal. Create issues from markdown files, search with JQL, download entire Confluence spaces as markdown for AI context — all without opening a browser.

Three CLIs in one package: `jira`, `confluence`, and `download-confluence`.

## Setup

You need one set of Atlassian credentials. Add to `~/.zshrc`:

```bash
export ATLASSIAN_SITE="your-site.atlassian.net"
export ATLASSIAN_EMAIL="you@example.com"
export ATLASSIAN_API_TOKEN="your-token"
```

Get your API token at: https://id.atlassian.com/manage-profile/security/api-tokens

Optional — if your Jira instance uses a different custom field for story points:

```bash
export JIRA_STORY_POINTS_FIELD="customfield_10031"  # default
```

## jira

Full CRUD for Jira issues. Supports markdown descriptions (auto-converted to Atlassian Document Format).

```bash
# Get an issue
jira get PAD-123

# Search with JQL
jira search "project = PAD AND status = 'In Progress'"

# List projects (shows available keys and issue types)
jira projects

# Create from a markdown file
jira create -p PAD -t Bug -s "Auth failure on login" -d ./report.md

# Create with all the options
jira create -p PAD -t Story -s "Add dark mode" -P High -l "frontend,ui" -a "john@example.com" --parent PAD-100 --points 5

# Create from stdin (pipe from another command)
cat ./report.md | jira create -p PAD -t Bug -s "From investigation" --stdin

# Update an issue
jira update PAD-123 -s "New title" -P High
jira update PAD-123 -d ./new-description.md
jira update PAD-123 --points 3
jira update PAD-123 --unassign

# Add a comment (markdown auto-converted to ADF)
jira comment PAD-123 -m "Looks good, merging now"
jira comment PAD-123 -f ./investigation-notes.md
cat notes.md | jira comment PAD-123 --stdin

# Delete an issue
jira delete PAD-123

# Lookup a user
jira user "john@example.com"
```

### Create options

| Flag | Description |
|---|---|
| `-p, --project <key>` | Project key (required) |
| `-t, --type <type>` | Bug, Task, Story, etc. (required) |
| `-s, --summary <text>` | Issue title (required) |
| `-d, --description <file>` | Markdown file path |
| `--description-text <text>` | Inline description |
| `--stdin` | Read description from stdin |
| `-P, --priority <name>` | High, Medium, Low |
| `-l, --labels <list>` | Comma-separated labels |
| `-a, --assignee <email>` | Assignee email/name |
| `--parent <key>` | Parent issue key |
| `--points <number>` | Story points |
| `-j, --json` | JSON output |

### Update options

| Flag | Description |
|---|---|
| `-s, --summary <text>` | New title |
| `-d, --description <file>` | New description from file |
| `--description-text <text>` | New description inline |
| `--stdin` | Read description from stdin |
| `-P, --priority <name>` | New priority |
| `-l, --labels <list>` | Replace labels |
| `-a, --assignee <email>` | New assignee |
| `--unassign` | Remove assignee |
| `--points <number>` | Story points |
| `-j, --json` | JSON output |

## confluence

CRUD for Confluence pages.

```bash
# Get a page (renders as markdown by default)
confluence get 123456789
confluence get 123456789 --html    # raw HTML instead

# Search pages
confluence search "workflow builder" -l 10

# List pages in a space
confluence space ENG -l 50

# Create a page
confluence create -s ENG -t "New Page" --body-text "<p>Content here</p>"
confluence create -s ENG -t "From File" -b ./content.html
cat content.html | confluence create -s ENG -t "From Stdin" --stdin

# Update a page
confluence update 123456789 -t "New Title"
confluence update 123456789 -b ./new-content.html

# Add a comment (HTML storage format)
confluence comment 123456789 -m "<p>Updated the docs</p>"
confluence comment 123456789 -f ./comment.html
cat comment.html | confluence comment 123456789 --stdin

# Delete a page
confluence delete 123456789
```

## download-confluence

Download Confluence pages as local markdown files with YAML frontmatter. Built for giving AI tools (Claude, Cursor, etc.) context from your docs without needing API access at runtime.

```bash
# Download a single page
download-confluence page 672759810 -o ./.context/scratch/

# Download an entire space
download-confluence space ENG -o ./.context/reference/engineering/ -l 50

# Search and download matching pages
download-confluence search "workflow builder" -o ./.context/features/workflow-builder/
```

Each file gets frontmatter with title, page ID, source URL, and download timestamp — so you always know where it came from.

## License

[MIT](../../LICENSE)
