#!/usr/bin/env bun

/**
 * Confluence CLI - Fetch, create, update, and delete Confluence pages
 *
 * Usage:
 *   bun confluence.ts get <pageId>
 *   bun confluence.ts search "<query>" [-l <limit>]
 *   bun confluence.ts create --space <key> --title "<title>" [--body <file>]
 *   bun confluence.ts update <pageId> [--title "<title>"] [--body <file>]
 *   bun confluence.ts delete <pageId>
 */

import { Command } from 'commander';
import { log, spinner, summaryBox, createTable } from './lib/logger';
import {
  loadConfig,
  createClient,
  getPage,
  searchPages,
  getSpacePages,
  getSpace,
  createPage,
  updatePage,
  deletePage,
} from './lib/confluence';
import { htmlToMarkdown } from './lib/markdown';

const program = new Command();

program.name('confluence').description('Confluence CLI for managing pages').version('1.0.0');

// ============================================================================
// GET - Fetch a single page
// ============================================================================
program
  .command('get <pageId>')
  .description('Get a Confluence page by ID')
  .option('-j, --json', 'Output as JSON')
  .option('--html', 'Output body as HTML (default is markdown)')
  .action(async (pageId: string, options: { json?: boolean; html?: boolean }) => {
    if (!options.json) {
      log.title('Confluence - Get Page');
      log.subtitle();
    }

    const config = loadConfig();
    const client = createClient(config);

    const s = !options.json ? spinner(`Fetching page ${pageId}...`).start() : null;

    const page = await getPage(client, pageId);

    if (!page) {
      s?.fail(`Page ${pageId} not found`);
      process.exit(1);
    }

    s?.succeed(`Found: ${page.title}`);

    const body = options.html ? page.body : htmlToMarkdown(page.body);

    if (options.json) {
      console.log(JSON.stringify({ ...page, body }, null, 2));
      return;
    }

    log.blank();
    log.highlight(page.title);
    log.dim(`https://${config.site}/wiki/spaces/${page.spaceKey}/pages/${page.id}`);
    log.blank();

    const table = createTable(['Field', 'Value']);
    table.push(
      ['ID', page.id],
      ['Space', page.spaceKey || '-'],
      ['Version', String(page.version || '-')]
    );
    console.log(table.toString());

    log.blank();
    log.highlight('Content:');
    log.dim('─'.repeat(50));
    console.log(body);
  });

// ============================================================================
// SEARCH - Search pages
// ============================================================================
program
  .command('search <query>')
  .description('Search Confluence pages')
  .option('-l, --limit <number>', 'Maximum results', '25')
  .option('-j, --json', 'Output as JSON')
  .action(async (query: string, options: { limit: string; json?: boolean }) => {
    if (!options.json) {
      log.title('Confluence - Search');
      log.subtitle();
      log.dim(`Query: ${query}`);
    }

    const config = loadConfig();
    const client = createClient(config);

    const s = !options.json ? spinner('Searching...').start() : null;

    const results = await searchPages(client, query, parseInt(options.limit, 10));

    s?.succeed(`Found ${results.length} page(s)`);

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (results.length === 0) {
      log.warning('No pages found');
      return;
    }

    log.blank();

    const table = createTable(['ID', 'Space', 'Title']);
    results.forEach((page) => {
      table.push([page.id, page.spaceKey || '-', page.title]);
    });
    console.log(table.toString());
  });

// ============================================================================
// SPACES - List spaces
// ============================================================================
program
  .command('space <spaceKey>')
  .description('List pages in a space')
  .option('-l, --limit <number>', 'Maximum results', '25')
  .option('-j, --json', 'Output as JSON')
  .action(async (spaceKey: string, options: { limit: string; json?: boolean }) => {
    if (!options.json) {
      log.title('Confluence - Space Pages');
      log.subtitle();
    }

    const config = loadConfig();
    const client = createClient(config);

    const s = !options.json ? spinner(`Fetching pages from ${spaceKey}...`).start() : null;

    const space = await getSpace(client, spaceKey);
    if (!space) {
      s?.fail(`Space ${spaceKey} not found`);
      process.exit(1);
    }

    const pages = await getSpacePages(client, spaceKey, parseInt(options.limit, 10));

    s?.succeed(`Found ${pages.length} page(s) in ${space.name}`);

    if (options.json) {
      console.log(JSON.stringify({ space, pages }, null, 2));
      return;
    }

    if (pages.length === 0) {
      log.warning('No pages found');
      return;
    }

    log.blank();

    const table = createTable(['ID', 'Title']);
    pages.forEach((page) => {
      table.push([page.id, page.title]);
    });
    console.log(table.toString());
  });

// ============================================================================
// CREATE - Create a new page
// ============================================================================
program
  .command('create')
  .description('Create a new Confluence page')
  .requiredOption('-s, --space <key>', 'Space key')
  .requiredOption('-t, --title <title>', 'Page title')
  .option('-b, --body <file>', 'Body content from HTML file')
  .option('--body-text <text>', 'Body content as inline HTML')
  .option('--stdin', 'Read body from stdin')
  .option('-p, --parent <pageId>', 'Parent page ID')
  .option('-j, --json', 'Output as JSON')
  .action(
    async (options: {
      space: string;
      title: string;
      body?: string;
      bodyText?: string;
      stdin?: boolean;
      parent?: string;
      json?: boolean;
    }) => {
      if (!options.json) {
        log.title('Confluence - Create Page');
        log.subtitle();
      }

      const config = loadConfig();
      const client = createClient(config);

      // Get body content
      let body = '<p></p>'; // Default empty body

      if (options.stdin) {
        const chunks: Buffer[] = [];
        for await (const chunk of Bun.stdin.stream()) {
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks).toString('utf-8');
      } else if (options.body) {
        const file = Bun.file(options.body);
        if (!(await file.exists())) {
          log.error(`File not found: ${options.body}`);
          process.exit(1);
        }
        body = await file.text();
      } else if (options.bodyText) {
        body = options.bodyText;
      }

      const s = !options.json ? spinner('Creating page...').start() : null;

      const page = await createPage(client, {
        spaceKey: options.space,
        title: options.title,
        body,
        parentId: options.parent,
      });

      if (!page) {
        s?.fail('Failed to create page');
        process.exit(1);
      }

      s?.succeed(`Created: ${page.title}`);

      if (options.json) {
        console.log(JSON.stringify(page, null, 2));
        return;
      }

      log.blank();
      summaryBox('Page Created', {
        ID: page.id,
        Title: page.title,
        Space: page.spaceKey || '-',
        Version: String(page.version || 1),
      });
      log.blank();
      log.success(`URL: https://${config.site}/wiki/spaces/${page.spaceKey}/pages/${page.id}`);
    }
  );

// ============================================================================
// UPDATE - Update an existing page
// ============================================================================
program
  .command('update <pageId>')
  .description('Update an existing Confluence page')
  .option('-t, --title <title>', 'New title')
  .option('-b, --body <file>', 'New body from HTML file')
  .option('--body-text <text>', 'New body as inline HTML')
  .option('--stdin', 'Read body from stdin')
  .option('-j, --json', 'Output as JSON')
  .action(
    async (
      pageId: string,
      options: {
        title?: string;
        body?: string;
        bodyText?: string;
        stdin?: boolean;
        json?: boolean;
      }
    ) => {
      if (!options.json) {
        log.title('Confluence - Update Page');
        log.subtitle();
      }

      const config = loadConfig();
      const client = createClient(config);

      // Get body content
      let body: string | undefined;

      if (options.stdin) {
        const chunks: Buffer[] = [];
        for await (const chunk of Bun.stdin.stream()) {
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks).toString('utf-8');
      } else if (options.body) {
        const file = Bun.file(options.body);
        if (!(await file.exists())) {
          log.error(`File not found: ${options.body}`);
          process.exit(1);
        }
        body = await file.text();
      } else if (options.bodyText) {
        body = options.bodyText;
      }

      if (!options.title && !body) {
        log.error('Nothing to update. Provide --title or --body');
        process.exit(1);
      }

      const s = !options.json ? spinner(`Updating page ${pageId}...`).start() : null;

      const page = await updatePage(client, pageId, { title: options.title, body });

      if (!page) {
        s?.fail('Failed to update page');
        process.exit(1);
      }

      s?.succeed(`Updated: ${page.title}`);

      if (options.json) {
        console.log(JSON.stringify(page, null, 2));
        return;
      }

      log.blank();
      log.success(`URL: https://${config.site}/wiki/spaces/${page.spaceKey}/pages/${page.id}`);
    }
  );

// ============================================================================
// DELETE - Delete a page
// ============================================================================
program
  .command('delete <pageId>')
  .description('Delete a Confluence page')
  .option('-j, --json', 'Output as JSON')
  .action(async (pageId: string, options: { json?: boolean }) => {
    if (!options.json) {
      log.title('Confluence - Delete Page');
      log.subtitle();
    }

    const config = loadConfig();
    const client = createClient(config);

    // Fetch page first to confirm it exists
    const page = await getPage(client, pageId);
    if (!page) {
      log.error(`Page ${pageId} not found`);
      process.exit(1);
    }

    if (!options.json) {
      log.warning(`About to delete: ${page.title}`);
    }

    const s = !options.json ? spinner(`Deleting page ${pageId}...`).start() : null;

    const success = await deletePage(client, pageId);

    if (!success) {
      s?.fail('Failed to delete page');
      process.exit(1);
    }

    s?.succeed(`Deleted: ${page.title}`);

    if (options.json) {
      console.log(JSON.stringify({ deleted: true, id: pageId, title: page.title }));
    }
  });

program.parseAsync(process.argv);
