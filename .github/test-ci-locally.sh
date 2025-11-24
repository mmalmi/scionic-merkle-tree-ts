#!/bin/bash
# Test CI commands locally before pushing

set -e

echo "========================================="
echo "Testing CI Commands Locally"
echo "========================================="
echo

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test basic tests
echo "=== Test 1: Basic Tests (No Go Interop) ==="
echo "Command: npm test -- --testPathIgnorePatterns=\"goInterop|bitcoinRoundTrip|compareDirectory|chunkSizeComparison|debugHash|decodeGoLeaf|directoryDagSize|browser/\""
echo

npm test -- --testPathIgnorePatterns="goInterop|bitcoinRoundTrip|compareDirectory|chunkSizeComparison|debugHash|decodeGoLeaf|directoryDagSize|browser/" && \
echo -e "${GREEN}✓ Basic tests passed${NC}" || \
(echo -e "${RED}✗ Basic tests failed${NC}" && exit 1)

echo
echo "=== Test 2: Browser Tests ==="
echo "Command: npm run test:browser"
echo

npm run test:browser && \
echo -e "${GREEN}✓ Browser tests passed${NC}" || \
(echo -e "${RED}✗ Browser tests failed${NC}" && exit 1)

echo
echo "=== Test 3: Full Tests (With Go, requires Go repo) ==="
echo "Command: npm test -- --testPathIgnorePatterns=\"browser/\""
echo "Note: This requires the Go implementation at ../Scionic-Merkle-Tree"
echo

if [ ! -d "../Scionic-Merkle-Tree" ]; then
  echo -e "${RED}✗ Go repo not found. Skipping full tests.${NC}"
  echo "To test full CI, clone the Go repo:"
  echo "  cd .."
  echo "  git clone https://github.com/HORNET-Storage/Scionic-Merkle-Tree"
  echo "  cd Scionic-Merkle-Tree && go build -o scionic-merkle-tree ./cmd"
  exit 0
fi

export PATH="../Scionic-Merkle-Tree:$PATH"
npm test -- --testPathIgnorePatterns="browser/" && \
echo -e "${GREEN}✓ Full tests passed${NC}" || \
(echo -e "${RED}✗ Full tests failed${NC}" && exit 1)

echo
echo "========================================="
echo -e "${GREEN}All CI tests passed!${NC}"
echo "========================================="
