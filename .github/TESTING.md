# Testing CI Locally

This guide explains how to test the GitHub Actions CI workflows locally before pushing.

## Method 1: Run CI Commands Directly (Recommended)

Use the provided script to run all CI test commands:

```bash
./.github/test-ci-locally.sh
```

This script runs:
1. **Basic tests** (no Go interop) - 85 tests
2. **Browser tests** - 13 tests
3. **Full tests** (with Go interop) - 108 tests (requires Go repo)

### Manual Commands

You can also run individual test suites:

```bash
# Basic tests (what CI runs on Node 18/20/22)
npm test -- --testPathIgnorePatterns="goInterop|bitcoinRoundTrip|compareDirectory|chunkSizeComparison|debugHash|decodeGoLeaf|directoryDagSize|exactCborMatch|browser/"

# Browser tests
npm run test:browser

# Full tests with Go interop (requires Go repo checked out at ../Scionic-Merkle-Tree)
npm test -- --testPathIgnorePatterns="browser/"
```

## Method 2: Use `act` to Simulate GitHub Actions

[`act`](https://github.com/nektos/act) runs GitHub Actions workflows locally using Docker.

### Install act

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (via Chocolatey)
choco install act-cli
```

### Run Workflows

```bash
# Run all jobs
act

# Run specific job
act -j test-basic       # Basic tests only
act -j test-browser     # Browser tests only
act -j test-full        # Full tests with Go interop

# List available jobs
act -l
```

### Notes on `act`

- First run will prompt to select a Docker image (choose "Medium" for best compatibility)
- Requires Docker to be running
- Some GitHub-specific features may not work identically
- The test script (Method 1) is faster and more reliable for quick checks

## CI Workflow Jobs

Our CI has 3 jobs:

1. **test-basic** - Fast tests without external dependencies
   - Runs on Node 18.x, 20.x, 22.x
   - Skips Go interop tests
   - ~85 tests

2. **test-browser** - Browser-specific tests
   - Runs on Node 20.x
   - Uses Vitest for browser tests
   - ~13 tests
   - **Important:** This library is browser-first!

3. **test-full** - Complete test suite
   - Runs on Node 20.x
   - Includes Go interop tests
   - Checks out Go implementation
   - ~108 tests

## Troubleshooting

### "Go repo not found"

The full tests require the Go implementation. Clone it:

```bash
cd ..
git clone https://github.com/HORNET-Storage/Scionic-Merkle-Tree
cd Scionic-Merkle-Tree
go build -o scionic-merkle-tree ./cmd
cd ../scionic-merkle-tree-ts
```

### Browser tests failing

Make sure you've built the browser bundle:

```bash
npm run build:browser
```

### act Docker issues

If `act` fails with Docker errors, try:

```bash
# Use a specific Docker image
act -P ubuntu-latest=catthehacker/ubuntu:act-latest

# Increase verbosity
act -v
```
