#!/usr/bin/env node
/**
 * Utility script to find MLX installation
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

function findMLX() {
  console.log('Searching for MLX installation...\n');

  // Method 1: Check if MLX Python package is installed
  try {
    const pythonPath = execSync('python3 -c "import mlx; print(mlx.__path__[0])"', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (pythonPath) {
      console.log('✓ MLX Python package found:', pythonPath);

      // Try to find the C++ library
      const possibleLibPaths = [
        join(pythonPath, '..', '..', '..', 'lib'),
        '/opt/homebrew/lib',
        '/usr/local/lib',
      ];

      for (const libPath of possibleLibPaths) {
        const mlxLib = join(libPath, 'libmlx.dylib');
        if (existsSync(mlxLib)) {
          console.log('✓ MLX library found:', mlxLib);
          return { pythonPath, libPath };
        }
      }
    }
  } catch (e) {
    console.log('✗ MLX Python package not found');
  }

  // Method 2: Check Homebrew
  try {
    const brewPrefix = execSync('brew --prefix mlx 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();

    if (brewPrefix && existsSync(brewPrefix)) {
      console.log('✓ MLX Homebrew installation found:', brewPrefix);
      return { libPath: join(brewPrefix, 'lib') };
    }
  } catch (e) {
    console.log('✗ MLX Homebrew package not found');
  }

  // Method 3: Check common paths
  const commonPaths = [
    '/opt/homebrew/lib/cmake/mlx',
    '/usr/local/lib/cmake/mlx',
    process.env.MLX_DIR,
  ].filter(Boolean);

  for (const path of commonPaths) {
    if (path && existsSync(path)) {
      console.log('✓ MLX CMake config found:', path);
      return { cmakePath: path };
    }
  }

  console.log('\n⚠ MLX not found. Please install MLX:');
  console.log('  pip install mlx');
  console.log('  # or');
  console.log('  brew install mlx');
  console.log('  # or build from source');

  return null;
}

const result = findMLX();

if (result) {
  console.log('\nMLX configuration:');
  console.log(JSON.stringify(result, null, 2));
}
