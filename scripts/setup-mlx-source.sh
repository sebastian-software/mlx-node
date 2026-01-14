#!/bin/bash
#
# Setup MLX Source for Parsing
#
# Downloads only the Python binding source files needed for code generation.
# Uses git sparse-checkout to minimize download size.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
MLX_SOURCE_DIR="${MLX_SOURCE_DIR:-$ROOT_DIR/.mlx-source}"
MLX_REPO="https://github.com/ml-explore/mlx.git"
MLX_BRANCH="${MLX_BRANCH:-main}"

echo "=== MLX Source Setup ==="
echo ""

# Check if already exists and is valid
if [ -d "$MLX_SOURCE_DIR/python/src" ] && [ -f "$MLX_SOURCE_DIR/python/src/ops.cpp" ]; then
    echo "MLX source already exists at: $MLX_SOURCE_DIR"
    echo ""

    # Count files
    CPP_COUNT=$(ls -1 "$MLX_SOURCE_DIR/python/src"/*.cpp 2>/dev/null | wc -l | tr -d ' ')
    echo "Found $CPP_COUNT .cpp files"
    echo ""

    read -p "Update to latest? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping update."
        exit 0
    fi

    echo "Updating..."
    cd "$MLX_SOURCE_DIR"
    git fetch --depth 1 origin "$MLX_BRANCH"
    git checkout FETCH_HEAD -- python/src
    echo "Updated to latest."
    exit 0
fi

echo "Target: $MLX_SOURCE_DIR"
echo "Branch: $MLX_BRANCH"
echo ""

# Create directory
mkdir -p "$MLX_SOURCE_DIR"
cd "$MLX_SOURCE_DIR"

# Initialize sparse checkout
echo "Initializing sparse checkout..."
git init -q
git remote add origin "$MLX_REPO"

# Configure sparse checkout - only python/src
git sparse-checkout init --cone
git sparse-checkout set python/src

# Fetch only the needed files with minimal depth
echo "Fetching python/src from MLX repository..."
git fetch --depth 1 origin "$MLX_BRANCH"
git checkout FETCH_HEAD

# Report results
echo ""
echo "=== Setup Complete ==="
CPP_COUNT=$(ls -1 "$MLX_SOURCE_DIR/python/src"/*.cpp 2>/dev/null | wc -l | tr -d ' ')
echo "Downloaded $CPP_COUNT .cpp files to:"
echo "  $MLX_SOURCE_DIR/python/src/"
echo ""
echo "Total size: $(du -sh "$MLX_SOURCE_DIR" | cut -f1)"
echo ""
echo "Set MLX_SOURCE environment variable or use default:"
echo "  export MLX_SOURCE=$MLX_SOURCE_DIR/python/src"
