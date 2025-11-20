/**
 * Browser vs Go interoperability test
 * Verify browser implementation produces same roots as Go
 */

import { describe, test, expect } from 'vitest';
import { createDagFromFile, verifyDag } from '../../src/browser';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { fromCBOR } from '../../src/serialize';

const BITCOIN_PDF_PATH = '/workspace/scionic-merkle-tree-ts/bitcoin.pdf';

describe('Browser vs Go Merkle Root Comparison', () => {
  test('browser bitcoin.pdf matches Go root (no chunking)', async () => {
    // Read bitcoin.pdf
    const content = fs.readFileSync(BITCOIN_PDF_PATH);

    console.log(`Bitcoin PDF size: ${content.length} bytes`);

    // Create DAG with browser API
    const browserDag = await createDagFromFile('bitcoin.pdf', content);

    console.log(`Browser root: ${browserDag.Root}`);
    console.log(`Browser leaves: ${Object.keys(browserDag.Leafs).length}`);

    // Verify browser DAG
    await verifyDag(browserDag);

    // Create DAG with Go
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-go-test-'));
    const goPdfPath = path.join(tempDir, 'bitcoin.pdf');
    fs.copyFileSync(BITCOIN_PDF_PATH, goPdfPath);

    const output = execSync(
      `cd /workspace/Scionic-Merkle-Tree && go run cmd/test_helper.go info "${goPdfPath}"`,
      { encoding: 'utf-8', timeout: 30000 }
    );

    console.log(`Go output: ${output}`);

    const rootMatch = output.match(/Root: (bafi[a-z2-7]+)/);
    expect(rootMatch).toBeTruthy();
    const goRoot = rootMatch![1];

    console.log(`Go root: ${goRoot}`);

    console.log(`\nComparison:`);
    console.log(`  Browser: ${browserDag.Root}`);
    console.log(`  Go:      ${goRoot}`);
    console.log(`  Match:   ${browserDag.Root === goRoot ? '✓ YES' : '✗ NO'}`);

    expect(browserDag.Root).toBe(goRoot);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('browser small file matches Go', async () => {
    const content = new TextEncoder().encode('test content for browser');

    // Browser DAG
    const browserDag = await createDagFromFile('test.txt', content);

    // Go DAG
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-small-test-'));
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, content);

    const goCborPath = path.join(tempDir, 'go.cbor');
    execSync(
      `cd /workspace/Scionic-Merkle-Tree && go run cmd/test_helper.go create "${testFile}" "${goCborPath}"`,
      { encoding: 'utf-8', timeout: 30000 }
    );

    const goDag = fromCBOR(fs.readFileSync(goCborPath));

    console.log(`\nSmall file comparison:`);
    console.log(`  Browser: ${browserDag.Root}`);
    console.log(`  Go:      ${goDag.Root}`);
    console.log(`  Match:   ${browserDag.Root === goDag.Root ? '✓ YES' : '✗ NO'}`);

    expect(browserDag.Root).toBe(goDag.Root);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('browser and Node.js produce same roots', async () => {
    const content = new TextEncoder().encode('consistency test content');

    // Browser API
    const browserDag = await createDagFromFile('consistent.txt', content);

    // Node.js API
    const { createDag } = await import('../../src/dag');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'consistency-test-'));
    const testFile = path.join(tempDir, 'consistent.txt');
    fs.writeFileSync(testFile, content);

    const nodeDag = await createDag(testFile, false);

    console.log(`\nBrowser vs Node.js:`);
    console.log(`  Browser: ${browserDag.Root}`);
    console.log(`  Node.js: ${nodeDag.Root}`);
    console.log(`  Match:   ${browserDag.Root === nodeDag.Root ? '✓ YES' : '✗ NO'}`);

    expect(browserDag.Root).toBe(nodeDag.Root);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('browser large file chunking matches Node.js', async () => {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const largeContent = new Uint8Array(CHUNK_SIZE + 1000);
    for (let i = 0; i < largeContent.length; i++) {
      largeContent[i] = i % 256;
    }

    // Browser API
    const browserDag = await createDagFromFile('large.bin', largeContent);

    // Node.js API
    const { createDag } = await import('../../src/dag');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'large-test-'));
    const testFile = path.join(tempDir, 'large.bin');
    fs.writeFileSync(testFile, largeContent);

    const nodeDag = await createDag(testFile, false);

    const browserChunks = Object.values(browserDag.Leafs).filter(l => l.Type === 'chunk');
    const nodeChunks = Object.values(nodeDag.Leafs).filter(l => l.Type === 'chunk');

    console.log(`\nLarge file chunking:`);
    console.log(`  Browser chunks: ${browserChunks.length}`);
    console.log(`  Node.js chunks: ${nodeChunks.length}`);
    console.log(`  Browser root: ${browserDag.Root}`);
    console.log(`  Node.js root: ${nodeDag.Root}`);
    console.log(`  Match: ${browserDag.Root === nodeDag.Root ? '✓ YES' : '✗ NO'}`);

    expect(browserChunks.length).toBe(nodeChunks.length);
    expect(browserDag.Root).toBe(nodeDag.Root);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('verify all leaf hashes match between browser and Node.js', async () => {
    const content = new TextEncoder().encode('leaf hash comparison test');

    // Browser
    const browserDag = await createDagFromFile('compare.txt', content);

    // Node.js
    const { createDag } = await import('../../src/dag');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leaf-compare-'));
    const testFile = path.join(tempDir, 'compare.txt');
    fs.writeFileSync(testFile, content);
    const nodeDag = await createDag(testFile, false);

    // Compare all leaf properties
    const browserRoot = browserDag.Leafs[browserDag.Root];
    const nodeRoot = nodeDag.Leafs[nodeDag.Root];

    console.log(`\nLeaf property comparison:`);
    console.log(`  ContentHash match: ${Buffer.from(browserRoot.ContentHash!).equals(Buffer.from(nodeRoot.ContentHash!))}`);
    console.log(`  ContentSize match: ${browserRoot.ContentSize === nodeRoot.ContentSize}`);
    console.log(`  DagSize match: ${browserRoot.DagSize === nodeRoot.DagSize}`);
    console.log(`  LeafCount match: ${browserRoot.LeafCount === nodeRoot.LeafCount}`);

    expect(browserRoot.Hash).toBe(nodeRoot.Hash);
    expect(Buffer.from(browserRoot.ContentHash!).equals(Buffer.from(nodeRoot.ContentHash!))).toBe(true);
    expect(browserRoot.ContentSize).toBe(nodeRoot.ContentSize);
    expect(browserRoot.DagSize).toBe(nodeRoot.DagSize);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
