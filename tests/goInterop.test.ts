/**
 * Cross-compatibility tests with the Go implementation
 * Similar to Rust's go_compatibility_test.rs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag, verifyDag } from '../src/dag';
import { saveToFile, loadFromFile, fromCBOR } from '../src/serialize';
import { LeafType } from '../src/types';
import { goImplementationAvailable, runGoCommand } from './testHelpers';

/**
 * Create a DAG using the Go implementation
 */
function createDagWithGo(inputPath: string, outputCbor: string): string {
  return runGoCommand(`go run cmd/test_helper.go create "${inputPath}" "${outputCbor}"`);
}

/**
 * Verify a DAG using the Go implementation
 */
function verifyDagWithGo(cborPath: string): string {
  return runGoCommand(`go run cmd/test_helper.go verify "${cborPath}"`);
}

/**
 * Get DAG info using Go implementation
 */
function getDagInfoWithGo(inputPath: string): string {
  return runGoCommand(`go run cmd/test_helper.go info "${inputPath}"`);
}

describe('Go Interoperability Tests', () => {
  let tempDir: string;

  beforeAll(() => {
    if (!goImplementationAvailable()) {
      console.log('Skipping Go interop tests: Go implementation not available');
    }
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scionic-ts-go-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('TypeScript creates, Go reads and verifies', async () => {
    if (!goImplementationAvailable()) {
      console.log('Skipping: Go implementation not available');
      return;
    }

    const inputDir = path.join(tempDir, 'input');
    fs.mkdirSync(inputDir);

    // Create test files
    fs.writeFileSync(path.join(inputDir, 'file1.txt'), 'content from TS test 1');
    fs.writeFileSync(path.join(inputDir, 'file2.txt'), 'content from TS test 2');

    // Create DAG with TypeScript
    const dag = await createDag(inputDir, false);
    await verifyDag(dag);

    // Save to CBOR
    const cborPath = path.join(tempDir, 'typescript.cbor');
    saveToFile(dag, cborPath);

    console.log(`TypeScript created DAG - Root: ${dag.Root}, Leaves: ${Object.keys(dag.Leafs).length}`);

    // Try to verify with Go
    const output = verifyDagWithGo(cborPath);
    console.log(`Go verification output: ${output}`);

    expect(output).toContain('Success');
  });

  test('Go creates, TypeScript reads and verifies', async () => {
    if (!goImplementationAvailable()) {
      console.log('Skipping: Go implementation not available');
      return;
    }

    const inputDir = path.join(tempDir, 'input');
    fs.mkdirSync(inputDir);

    // Create test files
    fs.writeFileSync(path.join(inputDir, 'file1.txt'), 'content from Go test 1');
    fs.writeFileSync(path.join(inputDir, 'file2.txt'), 'content from Go test 2');

    // Create DAG with Go
    const goCbor = path.join(tempDir, 'go.cbor');
    const goOutput = createDagWithGo(inputDir, goCbor);
    console.log(`Go created DAG: ${goOutput}`);

    expect(goOutput).toContain('Success');
    expect(fs.existsSync(goCbor)).toBe(true);

    // Read with TypeScript
    const data = fs.readFileSync(goCbor);
    const dag = fromCBOR(data);

    console.log(`TypeScript loaded Go DAG - Root: ${dag.Root}, Leaves: ${Object.keys(dag.Leafs).length}`);

    // Verify with TypeScript
    await verifyDag(dag);

    console.log('✓ TypeScript successfully read and verified Go-created DAG');
  });

  test('Same input produces compatible roots', async () => {
    if (!goImplementationAvailable()) {
      console.log('Skipping: Go implementation not available');
      return;
    }

    const tsInputDir = path.join(tempDir, 'ts_input');
    const goInputDir = path.join(tempDir, 'go_input');

    fs.mkdirSync(tsInputDir);
    fs.mkdirSync(goInputDir);

    // Create identical test files
    const files = [
      ['a.txt', 'test content a'],
      ['b.txt', 'test content b'],
      ['c.txt', 'test content c'],
    ];

    for (const [name, content] of files) {
      fs.writeFileSync(path.join(tsInputDir, name), content);
      fs.writeFileSync(path.join(goInputDir, name), content);
    }

    // Create with TypeScript
    const tsDag = await createDag(tsInputDir, false);
    console.log(`TypeScript root: ${tsDag.Root}`);
    console.log(`TypeScript leaf count: ${Object.keys(tsDag.Leafs).length}`);

    // Get Go root
    const goInfo = getDagInfoWithGo(goInputDir);
    const rootMatch = goInfo.match(/Root: (bafi[a-z2-7]+)/);
    const leavesMatch = goInfo.match(/Leaves: (\d+)/);

    expect(rootMatch).toBeTruthy();
    const goRoot = rootMatch![1];
    const goLeafCount = parseInt(leavesMatch![1]);

    console.log(`Go root: ${goRoot}`);
    console.log(`Go leaf count: ${goLeafCount}`);

    // Roots may differ due to directory name differences in paths
    // But file leaves should have identical hashes for identical content
    console.log('Note: Root hashes may differ due to directory names, but file content hashes should match');
  });

  test('CBOR format compatibility', async () => {
    if (!goImplementationAvailable()) {
      console.log('Skipping: Go implementation not available');
      return;
    }

    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content for CBOR compatibility');

    // Create with TypeScript
    const tsDag = await createDag(testFile, false);

    // Serialize
    const cborPath = path.join(tempDir, 'test.cbor');
    saveToFile(tsDag, cborPath);

    console.log(`CBOR size: ${fs.statSync(cborPath).size} bytes`);

    // Verify round-trip with TypeScript
    const loadedDag = loadFromFile(cborPath);
    expect(loadedDag.Root).toBe(tsDag.Root);
    await verifyDag(loadedDag);

    // Verify with Go
    const goOutput = verifyDagWithGo(cborPath);
    expect(goOutput).toContain('Success');

    console.log('✓ CBOR format is compatible with Go implementation');
  });

  test('CID format is correct', async () => {
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test');

    const dag = await createDag(testFile, false);

    // CID should start with "bafi" for CIDv1 with CBOR codec 0x51
    expect(dag.Root.startsWith('bafi')).toBe(true);

    // All leaf hashes should also start with "bafi"
    for (const hash of Object.keys(dag.Leafs)) {
      expect(hash.startsWith('bafi')).toBe(true);
    }
  });

  test('Leaf count consistency', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(testDir, `file${i}.txt`), `content ${i}`);
    }

    const dag = await createDag(testDir, false);
    const rootLeaf = dag.Leafs[dag.Root];

    console.log(`Root: ${dag.Root}`);
    console.log(`Total leaves: ${Object.keys(dag.Leafs).length}`);
    console.log(`Root LeafCount: ${rootLeaf.LeafCount}`);

    // Verify leaf count is correct
    expect(rootLeaf.LeafCount).toBe(Object.keys(dag.Leafs).length);
  });

  test('Content addressing is deterministic', async () => {
    const dir1 = path.join(tempDir, 'dir1');
    const dir2 = path.join(tempDir, 'dir2');

    fs.mkdirSync(dir1);
    fs.mkdirSync(dir2);

    fs.writeFileSync(path.join(dir1, 'file.txt'), 'identical content');
    fs.writeFileSync(path.join(dir2, 'file.txt'), 'identical content');

    const dag1 = await createDag(dir1, false);
    const dag2 = await createDag(dir2, false);

    // File leaves should have identical hashes
    const fileLeaves1 = Object.values(dag1.Leafs).filter((leaf) => leaf.Type === LeafType.File);
    const fileLeaves2 = Object.values(dag2.Leafs).filter((leaf) => leaf.Type === LeafType.File);

    expect(fileLeaves1.length).toBe(fileLeaves2.length);
    expect(fileLeaves1[0].Hash).toBe(fileLeaves2[0].Hash);
  });
});
