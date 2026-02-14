#!/usr/bin/env bun

/**
 * Jira CLI - Fetch and create Jira issues
 *
 * Usage:
 *   bun jira.ts get <issueKey>
 *   bun jira.ts search "<JQL>"
 *   bun jira.ts create --project <key> --type <type> --summary "<text>" [--description <file>]
 *   bun jira.ts projects
 */

import { Command } from 'commander';
import { log, spinner, summaryBox, createTable } from '@uncskit/shared';
import {
  loadConfig,
  createClient,
  getIssue,
  searchIssues,
  getProjects,
  createIssue,
  updateIssue,
  deleteIssue,
  findUser,
  addComment,
} from './lib/jira.ts';

const program = new Command();

program.name('jira').description('Jira CLI for fetching and creating issues').version('1.0.0');

// ============================================================================
// GET - Fetch a single issue
// ============================================================================
program
  .command('get <issueKey>')
  .description('Get a Jira issue by key (e.g., ENG-123)')
  .option('-j, --json', 'Output as JSON')
  .action(async (issueKey: string, options: { json?: boolean }) => {
    if (!options.json) {
      log.title('Jira - Get Issue');
      log.subtitle();
    }

    const config = loadConfig();
    const client = createClient(config);

    const s = !options.json ? spinner(`Fetching ${issueKey}...`).start() : null;

    const issue = await getIssue(client, issueKey);

    if (!issue) {
      s?.fail(`Issue ${issueKey} not found`);
      process.exit(1);
    }

    s?.succeed(`Found ${issue.key}`);

    if (options.json) {
      console.log(JSON.stringify(issue, null, 2));
      return;
    }

    log.blank();
    log.highlight(`${issue.key}: ${issue.summary}`);
    log.dim(issue.url);
    log.blank();

    const table = createTable(['Field', 'Value']);
    table.push(
      ['Status', issue.status],
      ['Type', issue.issueType],
      ['Priority', issue.priority || '-'],
      ['Assignee', issue.assignee || 'Unassigned'],
      ['Reporter', issue.reporter || '-'],
      ['Labels', issue.labels?.join(', ') || '-'],
      ['Created', issue.created ? new Date(issue.created).toLocaleString() : '-'],
      ['Updated', issue.updated ? new Date(issue.updated).toLocaleString() : '-']
    );
    console.log(table.toString());

    if (issue.description) {
      log.blank();
      log.highlight('Description:');
      log.dim('─'.repeat(50));
      console.log(issue.description);
    }
  });

// ============================================================================
// SEARCH - Search issues with JQL
// ============================================================================
program
  .command('search <jql>')
  .description('Search Jira issues using JQL')
  .option('-l, --limit <number>', 'Maximum results', '25')
  .option('-j, --json', 'Output as JSON')
  .action(async (jql: string, options: { limit: string; json?: boolean }) => {
    if (!options.json) {
      log.title('Jira - Search');
      log.subtitle();
      log.dim(`JQL: ${jql}`);
    }

    const config = loadConfig();
    const client = createClient(config);

    const s = !options.json ? spinner('Searching...').start() : null;

    const result = await searchIssues(client, jql, parseInt(options.limit, 10));

    s?.succeed(`Found ${result.total} issue(s)`);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.issues.length === 0) {
      log.warning('No issues found');
      return;
    }

    log.blank();

    const table = createTable(['Key', 'Type', 'Status', 'Summary', 'Assignee']);
    result.issues.forEach((issue) => {
      table.push([
        issue.key,
        issue.issueType,
        issue.status,
        issue.summary.length > 50 ? issue.summary.slice(0, 47) + '...' : issue.summary,
        issue.assignee || '-',
      ]);
    });
    console.log(table.toString());

    if (result.total > result.issues.length) {
      log.dim(`Showing ${result.issues.length} of ${result.total} results`);
    }
  });

// ============================================================================
// PROJECTS - List available projects
// ============================================================================
program
  .command('projects')
  .description('List available Jira projects')
  .option('-j, --json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    if (!options.json) {
      log.title('Jira - Projects');
      log.subtitle();
    }

    const config = loadConfig();
    const client = createClient(config);

    const s = !options.json ? spinner('Fetching projects...').start() : null;

    const projects = await getProjects(client);

    s?.succeed(`Found ${projects.length} project(s)`);

    if (options.json) {
      console.log(JSON.stringify(projects, null, 2));
      return;
    }

    if (projects.length === 0) {
      log.warning('No projects found');
      return;
    }

    log.blank();

    const table = createTable(['Key', 'Name', 'Issue Types']);
    projects.forEach((project) => {
      table.push([
        project.key,
        project.name,
        project.issueTypes.map((t) => t.name).join(', '),
      ]);
    });
    console.log(table.toString());
  });

// ============================================================================
// CREATE - Create a new issue
// ============================================================================
program
  .command('create')
  .description('Create a new Jira issue')
  .requiredOption('-p, --project <key>', 'Project key (e.g., ENG)')
  .requiredOption('-t, --type <type>', 'Issue type (e.g., Bug, Task, Story)')
  .requiredOption('-s, --summary <text>', 'Issue summary/title')
  .option('-d, --description <file>', 'Description markdown file path')
  .option('--description-text <text>', 'Description as inline text')
  .option('--stdin', 'Read description from stdin')
  .option('-P, --priority <priority>', 'Priority (e.g., High, Medium, Low)')
  .option('-l, --labels <labels>', 'Comma-separated labels')
  .option('-a, --assignee <email>', 'Assignee email or name')
  .option('--parent <key>', 'Parent issue key (epic for stories, story for subtasks)')
  .option('--points <number>', 'Story points')
  .option('-j, --json', 'Output as JSON')
  .action(
    async (options: {
      project: string;
      type: string;
      summary: string;
      description?: string;
      descriptionText?: string;
      stdin?: boolean;
      priority?: string;
      labels?: string;
      assignee?: string;
      parent?: string;
      points?: string;
      json?: boolean;
    }) => {
      if (!options.json) {
        log.title('Jira - Create Issue');
        log.subtitle();
      }

      const config = loadConfig();
      const client = createClient(config);

      // Get description content
      let description: string | undefined;

      if (options.stdin) {
        // Read from stdin
        const chunks: Uint8Array[] = [];
        for await (const chunk of Bun.stdin.stream()) {
          chunks.push(chunk);
        }
        description = Buffer.concat(chunks).toString('utf-8');
      } else if (options.description) {
        // Read from file
        const file = Bun.file(options.description);
        if (!(await file.exists())) {
          log.error(`File not found: ${options.description}`);
          process.exit(1);
        }
        description = await file.text();
      } else if (options.descriptionText) {
        description = options.descriptionText;
      }

      // Lookup assignee
      let assigneeAccountId: string | undefined;
      if (options.assignee) {
        const s = !options.json ? spinner(`Looking up user: ${options.assignee}...`).start() : null;
        const user = await findUser(client, options.assignee);
        if (user) {
          assigneeAccountId = user.accountId;
          s?.succeed(`Found user: ${user.displayName}`);
        } else {
          s?.warn(`User not found: ${options.assignee}`);
        }
      }

      const s = !options.json ? spinner('Creating issue...').start() : null;

      const issue = await createIssue(client, {
        projectKey: options.project,
        issueType: options.type,
        summary: options.summary,
        description,
        priority: options.priority,
        labels: options.labels?.split(',').map((l) => l.trim()),
        assigneeAccountId,
        parentKey: options.parent,
        storyPoints: options.points ? parseInt(options.points, 10) : undefined,
      });

      if (!issue) {
        s?.fail('Failed to create issue');
        process.exit(1);
      }

      s?.succeed(`Created ${issue.key}`);

      if (options.json) {
        console.log(JSON.stringify(issue, null, 2));
        return;
      }

      log.blank();
      summaryBox('Issue Created', {
        Key: issue.key,
        Type: issue.issueType,
        Status: issue.status,
        Priority: issue.priority || '-',
      });
      log.blank();
      log.success(`URL: ${issue.url}`);
    }
  );

// ============================================================================
// USER - Lookup user
// ============================================================================
program
  .command('user <query>')
  .description('Lookup a user by email or name')
  .option('-j, --json', 'Output as JSON')
  .action(async (query: string, options: { json?: boolean }) => {
    if (!options.json) {
      log.title('Jira - User Lookup');
      log.subtitle();
    }

    const config = loadConfig();
    const client = createClient(config);

    const s = !options.json ? spinner(`Searching for "${query}"...`).start() : null;

    const user = await findUser(client, query);

    if (!user) {
      s?.fail('User not found');
      process.exit(1);
    }

    s?.succeed('User found');

    if (options.json) {
      console.log(JSON.stringify(user, null, 2));
      return;
    }

    log.blank();
    log.highlight(user.displayName);
    log.item(`Account ID: ${user.accountId}`);
    if (user.email) {
      log.item(`Email: ${user.email}`);
    }
  });

// ============================================================================
// UPDATE - Update an existing issue
// ============================================================================
program
  .command('update <issueKey>')
  .description('Update an existing Jira issue')
  .option('-s, --summary <text>', 'New summary/title')
  .option('-d, --description <file>', 'New description from markdown file')
  .option('--description-text <text>', 'New description as inline text')
  .option('--stdin', 'Read description from stdin')
  .option('-P, --priority <priority>', 'New priority (e.g., High, Medium, Low)')
  .option('-l, --labels <labels>', 'New labels (comma-separated, replaces existing)')
  .option('-a, --assignee <email>', 'New assignee email or name')
  .option('--unassign', 'Remove assignee')
  .option('--points <number>', 'Story points')
  .option('-j, --json', 'Output as JSON')
  .action(
    async (
      issueKey: string,
      options: {
        summary?: string;
        description?: string;
        descriptionText?: string;
        stdin?: boolean;
        priority?: string;
        labels?: string;
        assignee?: string;
        unassign?: boolean;
        points?: string;
        json?: boolean;
      }
    ) => {
      if (!options.json) {
        log.title('Jira - Update Issue');
        log.subtitle();
      }

      const config = loadConfig();
      const client = createClient(config);

      // Get description content
      let description: string | undefined;

      if (options.stdin) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of Bun.stdin.stream()) {
          chunks.push(chunk);
        }
        description = Buffer.concat(chunks).toString('utf-8');
      } else if (options.description) {
        const file = Bun.file(options.description);
        if (!(await file.exists())) {
          log.error(`File not found: ${options.description}`);
          process.exit(1);
        }
        description = await file.text();
      } else if (options.descriptionText) {
        description = options.descriptionText;
      }

      // Lookup assignee
      let assigneeAccountId: string | null | undefined;
      if (options.unassign) {
        assigneeAccountId = null;
      } else if (options.assignee) {
        const s = !options.json ? spinner(`Looking up user: ${options.assignee}...`).start() : null;
        const user = await findUser(client, options.assignee);
        if (user) {
          assigneeAccountId = user.accountId;
          s?.succeed(`Found user: ${user.displayName}`);
        } else {
          s?.warn(`User not found: ${options.assignee}`);
        }
      }

      const s = !options.json ? spinner(`Updating ${issueKey}...`).start() : null;

      const success = await updateIssue(client, issueKey, {
        summary: options.summary,
        description,
        priority: options.priority,
        labels: options.labels?.split(',').map((l) => l.trim()),
        assigneeAccountId,
        storyPoints: options.points ? parseInt(options.points, 10) : undefined,
      });

      if (!success) {
        s?.fail('Failed to update issue');
        process.exit(1);
      }

      s?.succeed(`Updated ${issueKey}`);

      // Fetch updated issue
      const issue = await getIssue(client, issueKey);

      if (options.json) {
        console.log(JSON.stringify(issue, null, 2));
        return;
      }

      if (issue) {
        log.blank();
        log.success(`URL: ${issue.url}`);
      }
    }
  );

// ============================================================================
// COMMENT - Add a comment to an issue
// ============================================================================
program
  .command('comment <issueKey>')
  .description('Add a comment to a Jira issue')
  .option('-m, --message <text>', 'Comment text (markdown)')
  .option('-f, --file <path>', 'Read comment from a markdown file')
  .option('--stdin', 'Read comment from stdin')
  .option('-j, --json', 'Output as JSON')
  .action(
    async (
      issueKey: string,
      options: {
        message?: string;
        file?: string;
        stdin?: boolean;
        json?: boolean;
      }
    ) => {
      if (!options.json) {
        log.title('Jira - Add Comment');
        log.subtitle();
      }

      const config = loadConfig();
      const client = createClient(config);

      // Get comment body
      let body: string | undefined;

      if (options.stdin) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of Bun.stdin.stream()) {
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks).toString('utf-8');
      } else if (options.file) {
        const file = Bun.file(options.file);
        if (!(await file.exists())) {
          log.error(`File not found: ${options.file}`);
          process.exit(1);
        }
        body = await file.text();
      } else if (options.message) {
        body = options.message;
      }

      if (!body) {
        log.error('No comment provided. Use -m, -f, or --stdin');
        process.exit(1);
      }

      const s = !options.json ? spinner(`Adding comment to ${issueKey}...`).start() : null;

      const success = await addComment(client, issueKey, body);

      if (!success) {
        s?.fail('Failed to add comment');
        process.exit(1);
      }

      s?.succeed(`Comment added to ${issueKey}`);

      if (options.json) {
        console.log(JSON.stringify({ commented: true, key: issueKey }));
        return;
      }

      const issue = await getIssue(client, issueKey);
      if (issue) {
        log.blank();
        log.success(`URL: ${issue.url}`);
      }
    }
  );

// ============================================================================
// DELETE - Delete an issue
// ============================================================================
program
  .command('delete <issueKey>')
  .description('Delete a Jira issue')
  .option('-y, --yes', 'Skip confirmation')
  .option('-j, --json', 'Output as JSON')
  .action(async (issueKey: string, options: { yes?: boolean; json?: boolean }) => {
    if (!options.json) {
      log.title('Jira - Delete Issue');
      log.subtitle();
    }

    const config = loadConfig();
    const client = createClient(config);

    // Fetch issue first to confirm it exists
    const issue = await getIssue(client, issueKey);
    if (!issue) {
      log.error(`Issue ${issueKey} not found`);
      process.exit(1);
    }

    if (!options.json) {
      log.warning(`About to delete: ${issue.key} - ${issue.summary}`);
    }

    const s = !options.json ? spinner(`Deleting ${issueKey}...`).start() : null;

    const success = await deleteIssue(client, issueKey);

    if (!success) {
      s?.fail('Failed to delete issue');
      process.exit(1);
    }

    s?.succeed(`Deleted ${issueKey}`);

    if (options.json) {
      console.log(JSON.stringify({ deleted: true, key: issueKey }));
    }
  });

program.parseAsync(process.argv);
