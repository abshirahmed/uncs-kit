#!/usr/bin/env bun

/**
 * Links all CLI binaries as shim scripts.
 * Run once after cloning: `bun run setup`
 *
 * - macOS/Linux: generates shell scripts in ~/.local/bin/
 * - Windows: generates .cmd files in %LOCALAPPDATA%\bin\
 */

import { resolve, join } from "path";
import { readdir, mkdir, writeFile, chmod } from "fs/promises";

const isWindows = process.platform === "win32";
const ROOT = import.meta.dir;
const PACKAGES_DIR = join(ROOT, "packages");

const BIN_DIR = isWindows
  ? join(process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE!, "AppData", "Local"), "bin")
  : join(process.env.HOME!, ".local", "bin");

async function getPackageBins(): Promise<{ name: string; path: string }[]> {
  const bins: { name: string; path: string }[] = [];
  const packages = await readdir(PACKAGES_DIR, { withFileTypes: true });

  for (const pkg of packages) {
    if (!pkg.isDirectory()) continue;

    const pkgJsonPath = join(PACKAGES_DIR, pkg.name, "package.json");
    const file = Bun.file(pkgJsonPath);
    if (!(await file.exists())) continue;

    const pkgJson = await file.json();
    if (!pkgJson.bin) continue;

    for (const [binName, binPath] of Object.entries(pkgJson.bin as Record<string, string>)) {
      bins.push({
        name: binName,
        path: resolve(PACKAGES_DIR, pkg.name, binPath),
      });
    }
  }

  return bins;
}

const bins = await getPackageBins();

if (bins.length === 0) {
  console.log("No binaries found in packages.");
  process.exit(0);
}

await mkdir(BIN_DIR, { recursive: true });

for (const bin of bins) {
  if (isWindows) {
    const shimPath = join(BIN_DIR, `${bin.name}.cmd`);
    const shim = `@bun "${bin.path}" %*\r\n`;
    await writeFile(shimPath, shim);
  } else {
    const shimPath = join(BIN_DIR, bin.name);
    const shim = `#!/bin/sh\nexec bun "${bin.path}" "$@"\n`;
    await writeFile(shimPath, shim);
    await chmod(shimPath, 0o755);
  }
  console.log(`  ${bin.name} → ${bin.path}`);
}

console.log(`\nLinked ${bins.length} binaries to ${BIN_DIR}`);

// Check if BIN_DIR is in PATH
const separator = isWindows ? ";" : ":";
const pathDirs = (process.env.PATH ?? "").split(separator);
const inPath = pathDirs.some((dir) => resolve(dir) === resolve(BIN_DIR));

if (!inPath) {
  console.log(`\nNote: ${BIN_DIR} is not in your PATH.`);
  if (isWindows) {
    console.log(`  Run: setx PATH "%PATH%;${BIN_DIR}"`);
  } else {
    console.log(`  Add to your shell profile: export PATH="$HOME/.local/bin:$PATH"`);
  }
}
