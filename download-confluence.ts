#!/usr/bin/env bun

/**
 * Download Confluence pages to local .context folder
 *
 * Usage:
 *   bun scripts/download-confluence.ts page <pageId> -o <dir>
 *   bun scripts/download-confluence.ts space <spaceKey> -o <dir> [-l <limit>]
 *   bun scripts/download-confluence.ts search <query> -o <dir> [-l <limit>]
 */

import { Command } from 'commander';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import {
  createClient,
  getPage,
  getSpace,
  getSpacePages,
  loadConfig,
  searchPages,
  type SearchResult,
} from './lib/confluence';
import { log, spinner, summaryBox, itemList } from './lib/logger';
import { htmlToMarkdown, sanitizeFilename, generateFrontmatter } from './lib/markdown';

// Stats tracking
let successCount = 0;
let failCount = 0;
const failedPages: string[] = [];

/**
 * Download a single page and save as markdown
 */
async function downloadPage(pageId: string, outputDir: string): Promise<boolean> {
  const config = loadConfig();
  const client = createClient(config);

  const pageSpinner = spinner(`Fetching page ${pageId}...`).start();

  const page = await getPage(client, pageId);

  if (!page || !page.body) {
    pageSpinner.fail(`Failed to fetch page ${pageId}`);
    failCount++;
    failedPages.push(pageId);
    return false;
  }

  // Convert to markdown
  const markdown = htmlToMarkdown(page.body);
  const frontmatter = generateFrontmatter({
    title: page.title,
    page_id: page.id,
    source: `https://${config.site}/wiki/pages/${page.id}`,
    downloaded: new Date().toISOString(),
  });

  // Write file
  const filename = `${sanitizeFilename(page.title)}.md`;
  const filepath = join(outputDir, filename);

  await mkdir(outputDir, { recursive: true });
  await writeFile(filepath, frontmatter + markdown);

  pageSpinner.succeed(`Saved: ${filepath}`);
  successCount++;
  return true;
}

/**
 * Download multiple pages
 */
async function downloadPages(
  pages: SearchResult[],
  outputDir: string
): Promise<void> {
  const config = loadConfig();
  const client = createClient(config);

  for (const page of pages) {
    const pageSpinner = spinner(`Fetching ${page.title}...`).start();

    const fullPage = await getPage(client, page.id);

    if (!fullPage || !fullPage.body) {
      pageSpinner.fail(`Failed: ${page.title} (${page.id})`);
      failCount++;
      failedPages.push(page.id);
      continue;
    }

    // Convert to markdown
    const markdown = htmlToMarkdown(fullPage.body);
    const frontmatter = generateFrontmatter({
      title: fullPage.title,
      page_id: fullPage.id,
      source: `https://${config.site}/wiki/pages/${fullPage.id}`,
      downloaded: new Date().toISOString(),
    });

    // Write file
    const filename = `${sanitizeFilename(fullPage.title)}.md`;
    const filepath = join(outputDir, filename);

    await mkdir(outputDir, { recursive: true });
    await writeFile(filepath, frontmatter + markdown);

    pageSpinner.succeed(`Saved: ${filename}`);
    successCount++;
  }
}

// CLI Setup
const program = new Command();

program
  .name('download-confluence')
  .description('Download Confluence pages to local .context folder')
  .version('1.0.0');

program
  .command('page <pageId>')
  .description('Download a single page by ID')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .action(async (pageId: string, options: { output: string }) => {
    log.title('Confluence Page Download');
    log.subtitle();

    await downloadPage(pageId, options.output);

    summaryBox('Summary', {
      Downloaded: successCount,
      Failed: failCount,
    });
  });

program
  .command('space <spaceKey>')
  .description('Download all pages in a space')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .option('-l, --limit <number>', 'Max pages to download', '25')
  .action(async (spaceKey: string, options: { output: string; limit: string }) => {
    log.title('Confluence Space Download');
    log.subtitle();

    const config = loadConfig();
    const client = createClient(config);
    const limit = parseInt(options.limit, 10);

    // Get space info
    const spaceSpinner = spinner(`Fetching space ${spaceKey}...`).start();
    const space = await getSpace(client, spaceKey);

    if (!space) {
      spaceSpinner.fail(`Space not found: ${spaceKey}`);
      return;
    }

    spaceSpinner.succeed(`Found space: ${space.name} (${space.key})`);

    // Get pages
    const pagesSpinner = spinner('Fetching pages...').start();
    const pages = await getSpacePages(client, spaceKey, limit);

    if (pages.length === 0) {
      pagesSpinner.fail('No pages found in space');
      return;
    }

    pagesSpinner.succeed(`Found ${pages.length} pages`);

    // Show what we'll download
    itemList('Pages to download', pages.map((p) => p.title));
    log.blank();

    // Download
    await downloadPages(pages, options.output);

    summaryBox('Summary', {
      Downloaded: successCount,
      Failed: failCount,
    });

    if (failedPages.length > 0) {
      log.blank();
      log.dim(`Failed page IDs: ${failedPages.join(', ')}`);
    }
  });

program
  .command('search <query>')
  .description('Search and download matching pages')
  .requiredOption('-o, --output <dir>', 'Output directory')
  .option('-l, --limit <number>', 'Max pages to download', '25')
  .action(async (query: string, options: { output: string; limit: string }) => {
    log.title('Confluence Search & Download');
    log.subtitle();

    const config = loadConfig();
    const client = createClient(config);
    const limit = parseInt(options.limit, 10);

    // Search
    const searchSpinner = spinner(`Searching for "${query}"...`).start();
    const pages = await searchPages(client, query, limit);

    if (pages.length === 0) {
      searchSpinner.fail(`No pages found matching: ${query}`);
      return;
    }

    searchSpinner.succeed(`Found ${pages.length} pages`);

    // Show what we'll download
    itemList('Pages to download', pages.map((p) => `${p.title} (${p.id})`));
    log.blank();

    // Download
    await downloadPages(pages, options.output);

    summaryBox('Summary', {
      Downloaded: successCount,
      Failed: failCount,
    });

    if (failedPages.length > 0) {
      log.blank();
      log.dim(`Failed page IDs: ${failedPages.join(', ')}`);
    }
  });

program.parseAsync(process.argv).catch((err) => {
  log.error(String(err));
  process.exit(1);
});
