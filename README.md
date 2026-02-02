# Dev Scripts

CLI tools for development workflows. Built with Bun and TypeScript.

## Setup

```bash
cd scripts
bun install
```

Requires environment variables (add to `~/.zshrc`):

```bash
export CONFLUENCE_SITE="your-site.atlassian.net"
export CONFLUENCE_EMAIL="your@email.com"
export CONFLUENCE_API_TOKEN="your-token"  # https://id.atlassian.com/manage-profile/security/api-tokens

# Jira uses same credentials (or set JIRA_* separately)
export JIRA_SITE="your-site.atlassian.net"
export JIRA_EMAIL="your@email.com"
export JIRA_API_TOKEN="your-token"
```

## Scripts

### jira

Fetch and create Jira issues.

```bash
# Get an issue
bun jira.ts get ENG-123

# Search with JQL
bun jira.ts search "project = ENG AND status = 'In Progress'"

# List projects (shows available keys and issue types)
bun jira.ts projects

# Create from markdown file
bun jira.ts create -p ENG -t Bug -s "Auth failure" -d ./report.md

# Create from stdin
cat ./report.md | bun jira.ts create -p ENG -t Bug -s "From investigation" --stdin

# Create with all options
bun jira.ts create -p ENG -t Bug -s "Login broken" -d ./report.md -P High -l "auth,urgent" -a "john@example.com"

# Lookup user
bun jira.ts user "john@example.com"

# Update an issue
bun jira.ts update PAD-123 -s "New title" -P High
bun jira.ts update PAD-123 -d ./new-description.md
bun jira.ts update PAD-123 -a "john@example.com"
bun jira.ts update PAD-123 --unassign

# Delete an issue
bun jira.ts delete PAD-123
```

**Create options:**
| Flag | Description |
|------|-------------|
| `-p, --project <key>` | Project key (required) |
| `-t, --type <type>` | Bug, Task, Story, etc. (required) |
| `-s, --summary <text>` | Issue title (required) |
| `-d, --description <file>` | Markdown file path |
| `--description-text <text>` | Inline description |
| `--stdin` | Read description from stdin |
| `-P, --priority <name>` | High, Medium, Low |
| `-l, --labels <list>` | Comma-separated labels |
| `-a, --assignee <email>` | Assignee email/name |
| `-j, --json` | JSON output |

**Update options:**
| Flag | Description |
|------|-------------|
| `-s, --summary <text>` | New title |
| `-d, --description <file>` | New description from markdown file |
| `--description-text <text>` | New description as inline text |
| `--stdin` | Read description from stdin |
| `-P, --priority <name>` | New priority |
| `-l, --labels <list>` | New labels (replaces existing) |
| `-a, --assignee <email>` | New assignee |
| `--unassign` | Remove assignee |
| `-j, --json` | JSON output |

**Delete options:**
| Flag | Description |
|------|-------------|
| `-j, --json` | JSON output |

### confluence

Manage Confluence pages (CRUD operations).

```bash
# Get a page
bun confluence.ts get <pageId>
bun confluence.ts get 123456789 --json

# Search pages
bun confluence.ts search "workflow builder" -l 10

# List pages in a space
bun confluence.ts space ENG -l 50

# Create a page
bun confluence.ts create -s ENG -t "New Page Title" --body-text "<p>Content</p>"
bun confluence.ts create -s ENG -t "From File" -b ./content.html
cat content.html | bun confluence.ts create -s ENG -t "From Stdin" --stdin

# Update a page
bun confluence.ts update 123456789 -t "New Title"
bun confluence.ts update 123456789 -b ./new-content.html

# Delete a page
bun confluence.ts delete 123456789
```

**Create/Update options:**
| Flag | Description |
|------|-------------|
| `-s, --space <key>` | Space key (create only, required) |
| `-t, --title <title>` | Page title |
| `-b, --body <file>` | Body from HTML file |
| `--body-text <text>` | Body as inline HTML |
| `--stdin` | Read body from stdin |
| `-p, --parent <id>` | Parent page ID (create only) |
| `-j, --json` | JSON output |

### download-confluence

Download Confluence pages to `.context/` for offline reference.

```bash
# Download a single page
bun download-confluence.ts page <pageId> -o <output-dir>

# Download all pages in a space
bun download-confluence.ts space <spaceKey> -o <output-dir> [-l <limit>]

# Search and download
bun download-confluence.ts search "<query>" -o <output-dir> [-l <limit>]
```

**Examples:**

```bash
# Feature docs
bun download-confluence.ts search "workflow builder" -o ../.context/features/workflow-builder/

# Specific page
bun download-confluence.ts page 672759810 -o ../.context/scratch/

# Engineering space
bun download-confluence.ts space ENG -o ../.context/reference/engineering/ -l 50
```

### pull-all

Update git repos in parallel with smart branch handling.

```bash
# Pull current repo (if in a git repo)
bun pull-all.ts

# Pull all repos in a directory
bun pull-all.ts ~/projects

# Preview what would be pulled
bun pull-all.ts --dry-run

# Pull all repos regardless of branch
bun pull-all.ts --all

# JSON output for scripting
bun pull-all.ts --json
```

**Smart behavior:**

- Repos on `main`/`master`: Full `git pull`
- Repos on feature branches: Fetches main using `git fetch origin main:main` (updates local `main` without switching branches)
- Parallel execution for speed
- Summary table with status (updated, up-to-date, fetched, failed)

**Options:**
| Flag | Description |
|------|-------------|
| `-d, --dry-run` | Show what would be pulled |
| `-a, --all` | Pull all repos regardless of branch |
| `-j, --json` | JSON output |

## Project Structure

```
scripts/
├── jira.ts                   # Jira CLI (CRUD)
├── confluence.ts             # Confluence CLI (CRUD)
├── download-confluence.ts    # Confluence download to local files
├── pull-all.ts               # Git multi-repo updater
├── lib/
│   ├── jira.ts               # Jira API client (V3)
│   ├── confluence.ts         # Confluence API client
│   ├── logger.ts             # TUI utilities (colors, spinners, tables)
│   └── markdown.ts           # HTML → Markdown conversion
├── package.json
└── tsconfig.json
```

## Adding Scripts

1. Create `my-script.ts` in scripts root
2. Use `commander` for CLI, `lib/logger.ts` for output
3. Add reusable code to `lib/`
4. Update this README

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { log, spinner, summaryBox } from './lib/logger';

const program = new Command();
program.name('my-script').description('Does something').version('1.0.0');

program
  .command('action <arg>')
  .option('-o, --output <dir>', 'Output directory')
  .action(async (arg, options) => {
    log.title('My Script');
    log.subtitle();
    const s = spinner('Working...').start();
    // work
    s.succeed('Done');
    summaryBox('Summary', { Processed: 10 });
  });

program.parseAsync(process.argv);
```

## Dependencies

- **commander** - CLI argument parsing
- **chalk** - Terminal colors
- **ora** - Spinners
- **cli-table3** - Table output
- **jira.js** - Jira API client (V3)
- **confluence.js** - Confluence API client
- **node-html-markdown** - HTML → Markdown
