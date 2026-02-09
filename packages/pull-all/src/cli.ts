#!/usr/bin/env bun

/**
 * Pull All Repos - Update git repos (parallel)
 *
 * Smart behavior:
 *   - If current directory IS a git repo: pulls it directly
 *   - If current directory CONTAINS repos: pulls all subdirectory repos
 *
 * Usage:
 *   bun pull-all.ts                    # Pull current repo OR repos in current directory
 *   bun pull-all.ts ~/projects         # Pull repos in specified directory
 *   bun pull-all.ts --dry-run          # Show what would be pulled
 *   bun pull-all.ts --all              # Pull all repos regardless of branch
 */

import { Command } from 'commander';
import { log, spinner, summaryBox, createTable } from '@uncskit/shared';
import chalk from 'chalk';
import { $ } from 'bun';
import { join, resolve, basename } from 'path';
import { readdir, stat } from 'fs/promises';

const program = new Command();

// Directories to always skip
const SKIP_DIRS = new Set(['.git', 'node_modules', '.cache', 'dist', 'build', '.next']);

type PullResult = 'updated' | 'up-to-date' | 'failed' | 'skipped' | 'not-main' | 'fetched';

interface RepoStatus {
  name: string;
  isRepo: boolean;
  branch: string | null;
  result: PullResult;
  error: string | null;
}

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    const gitDir = join(dir, '.git');
    const stats = await stat(gitDir);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function getCurrentBranch(dir: string): Promise<string | null> {
  try {
    const result = await $`git -C ${dir} rev-parse --abbrev-ref HEAD`.quiet();
    return result.text().trim();
  } catch {
    return null;
  }
}

async function gitPull(dir: string): Promise<{ success: boolean; updated: boolean; output: string }> {
  try {
    const result = await $`git -C ${dir} pull`.quiet();
    const output = result.text().trim();
    const updated = !output.includes('Already up to date');
    return { success: true, updated, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, updated: false, output: message };
  }
}

async function gitFetchMain(dir: string): Promise<{ success: boolean; output: string }> {
  try {
    // Use main:main syntax to update LOCAL main branch (not just origin/main)
    // Try 'main' first, fall back to 'master'
    try {
      const result = await $`git -C ${dir} fetch origin main:main`.quiet();
      return { success: true, output: result.text().trim() };
    } catch {
      const result = await $`git -C ${dir} fetch origin master:master`.quiet();
      return { success: true, output: result.text().trim() };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, output: message };
  }
}

async function getRepoDirs(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const dirs: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
      dirs.push(entry.name);
    }
  }

  return dirs.sort();
}

async function scanRepo(name: string, root: string): Promise<RepoStatus> {
  const dir = join(root, name);
  const status: RepoStatus = {
    name,
    isRepo: false,
    branch: null,
    result: 'skipped',
    error: null,
  };

  status.isRepo = await isGitRepo(dir);
  if (!status.isRepo) {
    return status;
  }

  status.branch = await getCurrentBranch(dir);
  if (!status.branch) {
    status.error = 'Could not determine branch';
    status.result = 'failed';
  }

  return status;
}

async function pullRepo(status: RepoStatus, root: string): Promise<RepoStatus> {
  const dir = join(root, status.name);
  const { success, updated, output } = await gitPull(dir);

  if (success) {
    status.result = updated ? 'updated' : 'up-to-date';
  } else {
    status.result = 'failed';
    status.error = output;
  }

  return status;
}

async function fetchMainForRepo(status: RepoStatus, root: string): Promise<RepoStatus> {
  const dir = join(root, status.name);
  const { success, output } = await gitFetchMain(dir);

  if (success) {
    status.result = 'fetched';
  } else {
    status.result = 'failed';
    status.error = output;
  }

  return status;
}

function formatResult(result: PullResult): string {
  switch (result) {
    case 'updated':
      return chalk.green.bold('⬇ UPDATED');
    case 'up-to-date':
      return chalk.dim('✓ up to date');
    case 'failed':
      return chalk.red.bold('✗ FAILED');
    case 'skipped':
      return chalk.yellow('○ skipped');
    case 'not-main':
      return chalk.blue('◇ not on main');
    case 'fetched':
      return chalk.cyan('⬇ fetched main');
  }
}

function formatBranch(branch: string | null, result: PullResult): string {
  if (!branch) return chalk.dim('-');
  const isMain = branch === 'main' || branch === 'master';
  if (result === 'not-main' || result === 'fetched') {
    return chalk.cyan(branch);
  }
  return isMain ? chalk.green(branch) : chalk.yellow(branch);
}

program
  .name('pull-all')
  .description('Pull latest changes for all repos in a directory')
  .version('1.0.0')
  .argument('[directory]', 'Directory containing repos (default: current directory)')
  .option('-d, --dry-run', 'Show what would be pulled without pulling')
  .option('-a, --all', 'Pull all repos regardless of branch')
  .option('-j, --json', 'Output as JSON')
  .action(async (directory: string | undefined, options: { dryRun?: boolean; all?: boolean; json?: boolean }) => {
    const root = resolve(directory || process.cwd());
    const rootName = basename(root);
    const startTime = Date.now();

    // Check if current directory itself is a git repo
    const rootIsRepo = await isGitRepo(root);

    if (!options.json) {
      if (rootIsRepo) {
        log.title(`Pull Repo${options.dryRun ? ' (Dry Run)' : ''}`);
        log.dim(`Repo: ${root}`);
      } else {
        log.title(`Pull All Repos${options.dryRun ? ' (Dry Run)' : ''}`);
        log.dim(`Directory: ${root}`);
      }
      log.subtitle();
    }

    // Phase 1: Scan repos
    const scanSpinner = !options.json ? spinner('Scanning repos...').start() : null;

    let scanned: RepoStatus[];

    if (rootIsRepo) {
      // Current directory is a repo - scan it directly
      // Use '.' as name so join(root, '.') == root
      const branch = await getCurrentBranch(root);
      scanned = [
        {
          name: '.',
          isRepo: true,
          branch,
          result: 'skipped',
          error: branch ? null : 'Could not determine branch',
        },
      ];
      scanSpinner?.succeed('Current directory is a git repo');
    } else {
      // Scan subdirectories for repos
      const repoDirs = await getRepoDirs(root);
      const scanPromises = repoDirs.map((name) => scanRepo(name, root));
      scanned = await Promise.all(scanPromises);
      const repoCount = scanned.filter((s) => s.isRepo).length;
      scanSpinner?.succeed(`Found ${repoCount} repo${repoCount === 1 ? '' : 's'}`);
    }

    // Determine which repos to pull
    const toPull: RepoStatus[] = [];
    const notOnMain: RepoStatus[] = [];
    const skipped: RepoStatus[] = [];

    for (const status of scanned) {
      if (!status.isRepo) {
        skipped.push(status);
        continue;
      }

      const isMain = status.branch === 'main' || status.branch === 'master';

      if (!isMain && !options.all) {
        status.result = 'not-main';
        notOnMain.push(status);
        continue;
      }

      toPull.push(status);
    }

    // Phase 2: Pull repos in parallel (or show dry-run)
    let results: RepoStatus[] = [];

    if (options.dryRun) {
      // Dry run - just mark all as would-pull
      results = toPull.map((s) => ({ ...s, result: 'skipped' as PullResult }));

      if (!options.json) {
        log.blank();
        log.info(`Would pull ${toPull.length} repo${toPull.length === 1 ? '' : 's'}:`);
        toPull.forEach((s) => {
          const name = s.name === '.' ? rootName : s.name;
          log.item(`${name} (${s.branch})`);
        });
      }
    } else if (toPull.length > 0) {
      // Pull in parallel with live progress
      const pullCount = toPull.length;
      const pullLabel = pullCount === 1 ? 'repo' : 'repos';
      const pullSpinner = !options.json
        ? spinner(`Pulling ${pullCount} ${pullLabel}...`).start()
        : null;

      let completed = 0;
      let updated = 0;

      const pullPromises = toPull.map(async (status) => {
        const result = await pullRepo(status, root);
        completed++;
        if (result.result === 'updated') updated++;

        if (pullSpinner) {
          const progress = chalk.cyan(completed + '/' + pullCount);
          const updatedText = updated > 0 ? chalk.green(' (' + updated + ' updated)') : '';
          pullSpinner.text = `Pulling ${pullLabel}... ` + progress + updatedText;
        }

        return result;
      });

      results = await Promise.all(pullPromises);

      const updatedCount = results.filter((r) => r.result === 'updated').length;
      const failedCount = results.filter((r) => r.result === 'failed').length;

      if (failedCount > 0) {
        pullSpinner?.warn(`Completed with ${failedCount} error${failedCount === 1 ? '' : 's'}`);
      } else if (updatedCount > 0) {
        pullSpinner?.succeed(`Pulled ${updatedCount} update${updatedCount === 1 ? '' : 's'}`);
      } else {
        pullSpinner?.succeed(pullCount === 1 ? 'Repo up to date' : 'All repos up to date');
      }
    }

    // Phase 3: Fetch main for repos not on main (so they have latest main locally)
    let fetchedResults: RepoStatus[] = [];

    if (!options.dryRun && notOnMain.length > 0) {
      const fetchCount = notOnMain.length;
      const branchLabel = fetchCount === 1 ? 'branch' : 'branches';
      const fetchSpinner = !options.json
        ? spinner(`Fetching main for ${fetchCount} feature ${branchLabel}...`).start()
        : null;

      let fetchCompleted = 0;

      const fetchPromises = notOnMain.map(async (status) => {
        const result = await fetchMainForRepo(status, root);
        fetchCompleted++;

        if (fetchSpinner) {
          fetchSpinner.text = 'Fetching main... ' + chalk.cyan(fetchCompleted + '/' + fetchCount);
        }

        return result;
      });

      fetchedResults = await Promise.all(fetchPromises);

      const fetchFailedCount = fetchedResults.filter((r) => r.result === 'failed').length;

      if (fetchFailedCount > 0) {
        fetchSpinner?.warn(`Fetched with ${fetchFailedCount} error${fetchFailedCount === 1 ? '' : 's'}`);
      } else {
        fetchSpinner?.succeed(`Fetched main for ${fetchCount} ${branchLabel}`);
      }
    } else if (options.dryRun && notOnMain.length > 0) {
      // Mark them as would-fetch in dry run
      fetchedResults = notOnMain.map((s) => ({ ...s, result: 'not-main' as PullResult }));

      if (!options.json) {
        log.info(`Would fetch main for ${notOnMain.length} feature branch${notOnMain.length === 1 ? '' : 'es'}:`);
        notOnMain.forEach((s) => {
          const name = s.name === '.' ? rootName : s.name;
          log.item(`${name} (${s.branch})`);
        });
      }
    }

    // Combine all results
    const allResults = [...results, ...fetchedResults, ...skipped.filter((s) => s.isRepo)];

    // Calculate stats
    const stats = {
      updated: results.filter((r) => r.result === 'updated').length,
      upToDate: results.filter((r) => r.result === 'up-to-date').length,
      fetched: fetchedResults.filter((r) => r.result === 'fetched').length,
      failed: [...results, ...fetchedResults].filter((r) => r.result === 'failed').length,
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // JSON output
    if (options.json) {
      // Map display names for better readability
      const jsonResults = allResults.map((r) => ({
        ...r,
        name: r.name === '.' ? rootName : r.name,
      }));
      console.log(
        JSON.stringify(
          {
            results: jsonResults,
            summary: { ...stats, elapsed: `${elapsed}s` },
          },
          null,
          2
        )
      );
      return;
    }

    // Results table
    log.blank();

    const table = createTable(['Repo', 'Branch', 'Status']);

    // Sort: updated first, then fetched, then failed, then up-to-date, then not-main
    const sortOrder: Record<PullResult, number> = {
      updated: 0,
      fetched: 1,
      failed: 2,
      'up-to-date': 3,
      'not-main': 4,
      skipped: 5,
    };

    allResults
      .sort((a, b) => sortOrder[a.result] - sortOrder[b.result])
      .forEach((r) => {
        const displayName = r.name === '.' ? `${rootName} (current)` : r.name;
        table.push([displayName, formatBranch(r.branch, r.result), formatResult(r.result)]);
      });

    console.log(table.toString());

    // Summary box
    summaryBox(`Completed in ${elapsed}s`, {
      Updated: stats.updated,
      'Up to date': stats.upToDate,
      'Fetched main': stats.fetched,
      Failed: stats.failed,
    });

    // Show errors if any
    if (stats.failed > 0) {
      log.blank();
      log.error('Errors:');
      results
        .filter((r) => r.result === 'failed')
        .forEach((r) => {
          const name = r.name === '.' ? rootName : r.name;
          log.item(`${chalk.bold(name)}: ${r.error}`);
        });
    }
  });

program.parseAsync(process.argv);
