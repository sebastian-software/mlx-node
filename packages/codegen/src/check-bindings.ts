#!/usr/bin/env node
/**
 * Check if generated bindings are up-to-date with MLX Python bindings.
 *
 * Compares stored hash with current MLX Python bindings from GitHub.
 * Exit codes:
 *   0 - Up to date
 *   1 - Needs regeneration
 *   2 - Error
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HASH_FILE = path.join(__dirname, '..', '..', 'mlx-node', 'generated', '.bindings-hash');
const MLX_PYTHON_BASE = 'https://raw.githubusercontent.com/ml-explore/mlx/main/python/src';
const BINDING_FILES = ['ops.cpp', 'linalg.cpp', 'fft.cpp', 'random.cpp'];

async function fetchFile(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function computeCurrentHash(): Promise<string> {
  const contents: string[] = [];

  for (const file of BINDING_FILES) {
    const url = `${MLX_PYTHON_BASE}/${file}`;
    const content = await fetchFile(url);
    contents.push(content);
  }

  const combined = contents.join('\n');
  return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 16);
}

function getStoredHash(): string | null {
  try {
    return fs.readFileSync(HASH_FILE, 'utf-8').trim();
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isQuiet = args.includes('--quiet') || args.includes('-q');
  const shouldUpdate = args.includes('--update') || args.includes('-u');

  try {
    if (!isQuiet) {
      console.log('Checking MLX bindings...');
    }

    const currentHash = await computeCurrentHash();
    const storedHash = getStoredHash();

    if (shouldUpdate) {
      fs.writeFileSync(HASH_FILE, currentHash + '\n');
      console.log(`Updated hash: ${currentHash}`);
      process.exit(0);
    }

    if (!storedHash) {
      console.log('No stored hash found. Run with --update after generating bindings.');
      process.exit(1);
    }

    if (currentHash === storedHash) {
      if (!isQuiet) {
        console.log(`✓ Bindings up to date (${currentHash})`);
      }
      process.exit(0);
    } else {
      console.log(`⚠ Bindings may be outdated`);
      console.log(`  Stored:  ${storedHash}`);
      console.log(`  Current: ${currentHash}`);
      console.log('');
      console.log('Run: pnpm generate to regenerate bindings');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error checking bindings:', error);
    process.exit(2);
  }
}

main();
