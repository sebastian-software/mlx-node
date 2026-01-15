#!/usr/bin/env node
/**
 * Check if the pinned MLX version is up to date
 *
 * Usage:
 *   pnpm check:mlx-version
 *
 * Exit codes:
 *   0 - Up to date
 *   1 - Update available
 *   2 - Error occurred
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CMAKE_FILE = join(__dirname, '..', '..', 'mlx-node', 'CMakeLists.txt');
const MLX_REPO = 'ml-explore/mlx';

interface Version {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Extract MLX version from CMakeLists.txt
 */
function getPinnedVersion(): string {
  const content = readFileSync(CMAKE_FILE, 'utf-8');
  const match = content.match(/set\(MLX_GIT_TAG\s+"(v[\d.]+)"\)/);
  if (!match) {
    throw new Error('Could not find MLX_GIT_TAG in CMakeLists.txt');
  }
  return match[1];
}

/**
 * Fetch latest MLX release from GitHub
 */
async function getLatestVersion(): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${MLX_REPO}/releases/latest`,
    {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'mlx-node-version-checker',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.tag_name;
}

/**
 * Parse version string to comparable parts
 */
function parseVersion(version: string): Version {
  const match = version.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1;
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1;
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1;
  return 0;
}

async function main(): Promise<void> {
  console.log('Checking MLX version...\n');

  try {
    const pinned = getPinnedVersion();
    console.log(`Pinned version:  ${pinned}`);

    const latest = await getLatestVersion();
    console.log(`Latest release:  ${latest}`);
    console.log();

    const comparison = compareVersions(pinned, latest);

    if (comparison === 0) {
      console.log('✓ MLX is up to date');
      process.exit(0);
    } else if (comparison < 0) {
      console.log(`⚠ Update available: ${pinned} → ${latest}`);
      console.log();
      console.log('To update, edit packages/mlx-node/CMakeLists.txt:');
      console.log(`  set(MLX_GIT_TAG "${latest}")`);
      console.log();
      console.log(`Release notes: https://github.com/${MLX_REPO}/releases/tag/${latest}`);
      process.exit(1);
    } else {
      console.log(`? Pinned version (${pinned}) is newer than latest release (${latest})`);
      console.log('  This may indicate a pre-release or development version.');
      process.exit(0);
    }
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(2);
  }
}

main();
