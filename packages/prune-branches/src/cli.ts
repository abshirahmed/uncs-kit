#!/usr/bin/env bun
/**
 * Prune Branches - Delete local git branches safely
 *
 * Smart behavior:
 *   - If current directory IS a git repo: prunes it directly
 *   - If current directory CONTAINS repos: prunes all subdirectory repos
 *   - Skips branches with unpushed commits (unless --force)
 *
 * Usage:
 *   prune-branches                    # Prune current repo
 *   prune-branches ~/projects         # Prune all repos in directory
 *   prune-branches --checkout-main    # Switch to main before pruning
 *   prune-branches --force            # Skip unpushed-commit safety
 *   prune-branches --dry-run          # Preview what would happen
 */

import { Command } from 'commander';
import { log, spinner, summaryBox, createTable, itemList } from '@uncskit/shared';
import chalk from 'chalk';
import { resolve, basename, join } from 'path';
import {
  isGitRepo,
  getRepoDirs,
  fetchPrune,
  pruneRepo,
  type RepoResult,
  type BranchResult,
  type PruneOptions,
} from './lib/prune.ts';

const program = new Command();

function formatBranchStatus(status: BranchResult['status']): string {
  switch (status) {
    case 'deleted':
      return chalk.red.bold('✗ deleted');
    case 'would-delete':
      return chalk.cyan('~ would delete');
    case 'skipped':
      return chalk.yellow('○ skipped');
    case 'failed':
      return chalk.red('✗ failed');
  }
}

function formatSkippedDetail(branch: BranchResult): string {
  const count = branch.unpushedCommits ?? 0;
  const commitWord = count === 1 ? 'commit' : 'commits';
  const latest = branch.latestCommit ? ` (latest: ${branch.latestCommit})` : '';
  return `${count} ${commitWord}${latest}`;
}

function displaySingleRepo(
  result: RepoResult,
  options: { dryRun?: boolean; json?: boolean },
  elapsed: string
): void {
  if (options.json) return;

  const deleted = result.branches.filter((b) => b.status === 'deleted' || b.status === 'would-delete');
  const skipped = result.branches.filter((b) => b.status === 'skipped');
  const failed = result.branches.filter((b) => b.status === 'failed');

  if (result.branches.length === 0) {
    log.success('No branches to prune — already clean.');
    summaryBox(`Completed in ${elapsed}s`, { Deleted: 0, Skipped: 0 });
    return;
  }

  // Branch results table
  const table = createTable(['Branch', 'Status']);

  // Sort: deleted/would-delete first, then failed, then skipped
  const sortOrder: Record<string, number> = { deleted: 0, 'would-delete': 0, failed: 1, skipped: 2 };
  const sorted = [...result.branches].sort((a, b) => (sortOrder[a.status] ?? 3) - (sortOrder[b.status] ?? 3));

  for (const branch of sorted) {
    table.push([branch.name, formatBranchStatus(branch.status)]);
  }

  log.blank();
  console.log(table.toString());

  // Skipped branch details
  if (skipped.length > 0) {
    const skippedItems = skipped.map(
      (b) => `${chalk.bold(b.name)} — ${formatSkippedDetail(b)}`
    );
    itemList('Skipped branches (unpushed commits)', skippedItems);
  }

  const summary: Record<string, number> = {
    Deleted: deleted.length,
    Skipped: skipped.length,
  };
  if (failed.length > 0) {
    summary.Failed = failed.length;
  }
  summaryBox(`Completed in ${elapsed}s`, summary);
}

function displayMultiRepo(
  results: RepoResult[],
  options: { dryRun?: boolean; json?: boolean },
  elapsed: string
): void {
  if (options.json) return;

  // Repo summary table
  const table = createTable(['Repo', 'Deleted', 'Skipped', 'Status']);

  for (const result of results) {
    const repoName = basename(result.repo);
    const deleted = result.branches.filter((b) => b.status === 'deleted' || b.status === 'would-delete').length;
    const skipped = result.branches.filter((b) => b.status === 'skipped').length;
    const failed = result.branches.filter((b) => b.status === 'failed').length;

    let status: string;
    if (result.error) {
      status = chalk.red.bold('✗ error');
    } else if (failed > 0) {
      status = chalk.red.bold('✗ errors');
    } else if (skipped > 0 && deleted === 0) {
      status = chalk.yellow('○ skips');
    } else if (deleted > 0) {
      status = chalk.green('✓ done');
    } else {
      status = chalk.dim('✓ clean');
    }

    table.push([repoName, String(deleted), String(skipped), status]);
  }

  log.blank();
  console.log(table.toString());

  // Collect all skipped branches across repos
  const allSkipped: string[] = [];
  for (const result of results) {
    const repoName = basename(result.repo);
    for (const branch of result.branches) {
      if (branch.status === 'skipped') {
        allSkipped.push(`${chalk.bold(repoName)}/${branch.name} — ${formatSkippedDetail(branch)}`);
      }
    }
  }

  if (allSkipped.length > 0) {
    itemList('Skipped branches (unpushed commits)', allSkipped);
  }

  // Totals
  const totalDeleted = results.reduce(
    (sum, r) => sum + r.branches.filter((b) => b.status === 'deleted' || b.status === 'would-delete').length,
    0
  );
  const totalSkipped = results.reduce(
    (sum, r) => sum + r.branches.filter((b) => b.status === 'skipped').length,
    0
  );
  const totalFailed = results.reduce(
    (sum, r) => sum + r.branches.filter((b) => b.status === 'failed').length,
    0
  );

  const summary: Record<string, number> = {
    Repos: results.length,
    Deleted: totalDeleted,
    Skipped: totalSkipped,
  };
  if (totalFailed > 0) {
    summary.Failed = totalFailed;
  }
  summaryBox(`Completed in ${elapsed}s`, summary);
}

program
  .name('prune-branches')
  .description('Delete local git branches, skip branches with unpushed commits')
  .version('0.1.0')
  .argument('[directory]', 'Directory containing repos (default: current directory)')
  .option('-m, --checkout-main', 'Switch to main/master before pruning')
  .option('-f, --force', 'Delete all branches, even with unpushed commits')
  .option('--no-fetch', 'Skip git fetch --prune')
  .option('-d, --dry-run', 'Preview what would be deleted without deleting')
  .option('-j, --json', 'Output as JSON')
  .action(
    async (
      directory: string | undefined,
      options: {
        checkoutMain?: boolean;
        force?: boolean;
        fetch?: boolean;
        dryRun?: boolean;
        json?: boolean;
      }
    ) => {
      const root = resolve(directory || process.cwd());
      const rootName = basename(root);
      const startTime = Date.now();

      const noFetch = options.fetch === false; // Commander's --no-fetch sets options.fetch to false

      const pruneOptions: PruneOptions = {
        checkoutMain: options.checkoutMain ?? false,
        force: options.force ?? false,
        dryRun: options.dryRun ?? false,
      };

      const rootIsRepo = await isGitRepo(root);

      if (!options.json) {
        const suffix = options.dryRun ? ' (Dry Run)' : '';
        if (rootIsRepo) {
          log.title(`Prune Branches${suffix}`);
          log.dim(`Repo: ${root}`);
        } else {
          log.title(`Prune Branches${suffix}`);
          log.dim(`Directory: ${root}`);
        }
        log.subtitle();
      }

      if (rootIsRepo) {
        // Single repo mode

        // Phase 1: Fetch
        if (!noFetch) {
          const fetchSpinner = !options.json ? spinner('Fetching latest...').start() : null;
          const fetchSuccess = await fetchPrune(root);
          if (fetchSpinner) {
            fetchSuccess ? fetchSpinner.succeed('Fetched latest') : fetchSpinner.warn('Fetch failed');
          }
        }

        // Phase 2: Prune
        const pruneSpinner = !options.json ? spinner('Pruning branches...').start() : null;
        const result = await pruneRepo(root, pruneOptions);
        const deleted = result.branches.filter((b) => b.status === 'deleted' || b.status === 'would-delete').length;
        const skipped = result.branches.filter((b) => b.status === 'skipped').length;

        if (pruneSpinner) {
          if (result.branches.length === 0) {
            pruneSpinner.succeed('No branches to prune');
          } else if (deleted > 0) {
            pruneSpinner.succeed(`Pruned ${deleted} branch${deleted === 1 ? '' : 'es'}`);
          } else {
            pruneSpinner.succeed(`Checked ${skipped} branch${skipped === 1 ? '' : 'es'}`);
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                results: [{ repo: rootName, branches: result.branches }],
                summary: { repos: 1, deleted, skipped, elapsed: `${elapsed}s` },
              },
              null,
              2
            )
          );
          return;
        }

        displaySingleRepo(result, options, elapsed);
      } else {
        // Multi-repo mode
        const scanSpinner = !options.json ? spinner('Scanning repos...').start() : null;
        const repoDirs = await getRepoDirs(root);

        // Filter to actual git repos
        const repoChecks = await Promise.all(
          repoDirs.map(async (name) => ({ name, isRepo: await isGitRepo(join(root, name)) }))
        );
        const repos = repoChecks.filter((r) => r.isRepo).map((r) => r.name);

        if (repos.length === 0) {
          scanSpinner?.warn('No git repos found');
          return;
        }

        scanSpinner?.succeed(`Found ${repos.length} repo${repos.length === 1 ? '' : 's'}`);

        // Prune all repos in parallel
        const pruneSpinner = !options.json
          ? spinner(`Pruning branches across ${repos.length} repos...`).start()
          : null;

        let completed = 0;

        const results = await Promise.all(
          repos.map(async (name) => {
            const dir = join(root, name);
            if (!noFetch) {
              await fetchPrune(dir);
            }
            const result = await pruneRepo(dir, pruneOptions);
            result.repo = name;
            completed++;

            if (pruneSpinner) {
              pruneSpinner.text = `Pruning branches... ${chalk.cyan(`${completed}/${repos.length}`)}`;
            }

            return result;
          })
        );

        const totalDeleted = results.reduce(
          (sum, r) => sum + r.branches.filter((b) => b.status === 'deleted' || b.status === 'would-delete').length,
          0
        );

        if (pruneSpinner) {
          if (totalDeleted > 0) {
            pruneSpinner.succeed(
              `Pruned ${totalDeleted} branch${totalDeleted === 1 ? '' : 'es'} across ${repos.length} repos`
            );
          } else {
            pruneSpinner.succeed(`All ${repos.length} repos clean`);
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const totalSkipped = results.reduce(
          (sum, r) => sum + r.branches.filter((b) => b.status === 'skipped').length,
          0
        );

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                results: results.map((r) => ({
                  repo: r.repo,
                  branches: r.branches,
                })),
                summary: {
                  repos: repos.length,
                  deleted: totalDeleted,
                  skipped: totalSkipped,
                  elapsed: `${elapsed}s`,
                },
              },
              null,
              2
            )
          );
          return;
        }

        displayMultiRepo(results, options, elapsed);
      }
    }
  );

program.parseAsync(process.argv);
