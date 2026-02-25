import { $ } from 'bun';
import { join } from 'path';
import { readdir, stat } from 'fs/promises';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.cache', 'dist', 'build', '.next']);

export type BranchStatus = 'deleted' | 'skipped' | 'failed' | 'would-delete';

export interface BranchResult {
  name: string;
  status: BranchStatus;
  unpushedCommits?: number;
  latestCommit?: string;
  error?: string;
}

export interface RepoResult {
  repo: string;
  branches: BranchResult[];
  checkedOutMain: boolean;
  error?: string;
}

export interface PruneOptions {
  checkoutMain: boolean;
  force: boolean;
  dryRun: boolean;
}

export async function isGitRepo(dir: string): Promise<boolean> {
  try {
    const gitDir = join(dir, '.git');
    const stats = await stat(gitDir);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function getRepoDirs(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const dirs: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
      dirs.push(entry.name);
    }
  }

  return dirs.sort();
}

export async function fetchPrune(dir: string): Promise<boolean> {
  try {
    await $`git -C ${dir} fetch --prune`.quiet();
    return true;
  } catch {
    return false;
  }
}

export async function checkoutMain(dir: string): Promise<boolean> {
  try {
    await $`git -C ${dir} checkout main`.quiet();
    return true;
  } catch {
    try {
      await $`git -C ${dir} checkout master`.quiet();
      return true;
    } catch {
      return false;
    }
  }
}

export async function getCurrentBranch(dir: string): Promise<string | null> {
  try {
    const result = await $`git -C ${dir} rev-parse --abbrev-ref HEAD`.quiet();
    return result.text().trim();
  } catch {
    return null;
  }
}

export async function getLocalBranches(dir: string): Promise<string[]> {
  try {
    // Format string passed as variable — Bun's $ shell misparses %(…) as shell syntax
    const fmt = '%(refname:short)';
    const result = await $`git -C ${dir} branch --format=${fmt}`.quiet();
    return result.text().trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export async function getUnpushedInfo(
  dir: string,
  branch: string
): Promise<{ count: number; latest: string } | null> {
  try {
    const result = await $`git -C ${dir} log ${branch} --not --remotes --oneline`.quiet();
    const lines = result.text().trim().split('\n').filter(Boolean);
    if (lines.length === 0) return null;

    // First line format: "a1b2c3d commit message"
    const latest = lines[0]!.replace(/^\S+\s+/, '');
    return { count: lines.length, latest };
  } catch {
    return null;
  }
}

export async function deleteBranch(dir: string, branch: string): Promise<boolean> {
  try {
    await $`git -C ${dir} branch -D ${branch}`.quiet();
    return true;
  } catch {
    return false;
  }
}

export async function pruneRepo(dir: string, options: PruneOptions): Promise<RepoResult> {
  const result: RepoResult = {
    repo: dir,
    branches: [],
    checkedOutMain: false,
  };

  // Phase 1: Checkout main (optional)
  if (options.checkoutMain) {
    result.checkedOutMain = await checkoutMain(dir);
    if (!result.checkedOutMain) {
      result.error = 'Failed to checkout main/master';
      return result;
    }
  }

  // Phase 2: List branches to prune
  const currentBranch = await getCurrentBranch(dir);
  const allBranches = await getLocalBranches(dir);
  const toPrune = allBranches.filter((b) => b !== currentBranch);

  if (toPrune.length === 0) return result;

  // Phase 3: Check and delete each branch
  for (const branch of toPrune) {
    const branchResult: BranchResult = { name: branch, status: 'deleted' };

    // Check for unpushed commits (always in dry-run for info, otherwise only without --force)
    const unpushed = (!options.force || options.dryRun) ? await getUnpushedInfo(dir, branch) : null;

    // Safety: skip branches with unpushed commits (unless --force)
    if (!options.force && unpushed) {
      branchResult.status = 'skipped';
      branchResult.unpushedCommits = unpushed.count;
      branchResult.latestCommit = unpushed.latest;
      result.branches.push(branchResult);
      continue;
    }

    // Dry-run: mark as would-delete, include unpushed info if present
    if (options.dryRun) {
      branchResult.status = 'would-delete';
      if (unpushed) {
        branchResult.unpushedCommits = unpushed.count;
        branchResult.latestCommit = unpushed.latest;
      }
      result.branches.push(branchResult);
      continue;
    }

    const deleted = await deleteBranch(dir, branch);
    if (!deleted) {
      branchResult.status = 'failed';
      branchResult.error = 'git branch -D failed';
    }

    result.branches.push(branchResult);
  }

  return result;
}
