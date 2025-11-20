/**
 * Tests for Partial DAG support
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag, verifyDag } from '../src/dag';
import { getPartial, isPartial } from '../src/partial';
import { LeafType } from '../src/types';

describe('Partial DAG Support', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'partial-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getPartial creates subset of DAG', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content 1');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content 2');
    fs.writeFileSync(path.join(testDir, 'file3.txt'), 'content 3');

    const fullDag = await createDag(testDir, false);

    // Get file leaves
    const fileLeaves = Object.values(fullDag.Leafs).filter((leaf) => leaf.Type === LeafType.File);
    expect(fileLeaves.length).toBeGreaterThanOrEqual(2);

    // Create partial with first 2 files
    const requestedHashes = fileLeaves.slice(0, 2).map((leaf) => leaf.Hash);
    const partial = getPartial(fullDag, requestedHashes, false);

    console.log(`Full DAG: ${Object.keys(fullDag.Leafs).length} leaves`);
    console.log(`Partial DAG: ${Object.keys(partial.Leafs).length} leaves`);

    expect(partial.Root).toBe(fullDag.Root);
    expect(Object.keys(partial.Leafs).length).toBeLessThan(Object.keys(fullDag.Leafs).length);

    // Verify requested leaves are included
    for (const hash of requestedHashes) {
      expect(partial.Leafs[hash]).toBeDefined();
    }
  });

  test('getPartial includes verification path', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    const subdir = path.join(testDir, 'subdir');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'nested.txt'), 'nested content');

    const fullDag = await createDag(testDir, false);

    // Get the nested file
    const nestedLeaf = Object.values(fullDag.Leafs).find(
      (leaf) => leaf.ItemName === 'nested.txt'
    );
    expect(nestedLeaf).toBeDefined();

    const partial = getPartial(fullDag, [nestedLeaf!.Hash], false);

    // Should include: root, subdir, and nested file
    expect(partial.Leafs[fullDag.Root]).toBeDefined(); // Root
    expect(partial.Leafs[nestedLeaf!.Hash]).toBeDefined(); // Target

    console.log('✓ Partial DAG includes verification path to root');
  });

  test('getPartial with pruneLinks removes non-included links', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content 1');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content 2');
    fs.writeFileSync(path.join(testDir, 'file3.txt'), 'content 3');

    const fullDag = await createDag(testDir, false);
    const fileLeaves = Object.values(fullDag.Leafs).filter((leaf) => leaf.Type === LeafType.File);

    // Get partial with only first file
    const partial = getPartial(fullDag, [fileLeaves[0].Hash], true);

    const partialRoot = partial.Leafs[partial.Root];

    // Root should have links, but some pruned
    expect(partialRoot.Links).toBeDefined();
    if (partialRoot.Links) {
      expect(partialRoot.Links.length).toBeLessThan(fileLeaves.length);
    }

    console.log('✓ Links pruned in partial DAG');
  });

  test('getPartial throws for non-existent leaf', () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file.txt'), 'content');

    createDag(testDir, false).then((dag) => {
      expect(() => getPartial(dag, ['bafireinonexistenthash'], false)).toThrow('Leaf not found');
    });
  });

  test('getPartial throws for empty leaf list', () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file.txt'), 'content');

    createDag(testDir, false).then((dag) => {
      expect(() => getPartial(dag, [], false)).toThrow('No leaf hashes provided');
    });
  });

  test('isPartial detects partial DAGs', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content 1');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content 2');
    fs.writeFileSync(path.join(testDir, 'file3.txt'), 'content 3');

    const fullDag = await createDag(testDir, false);
    const fileLeaves = Object.values(fullDag.Leafs).filter((leaf) => leaf.Type === LeafType.File);

    expect(isPartial(fullDag)).toBe(false);

    // Create partial WITHOUT pruning (keeps links to missing leaves)
    const partial = getPartial(fullDag, [fileLeaves[0].Hash], false);

    // Partial DAG should be detected (has links to missing leaves)
    expect(isPartial(partial)).toBe(true);

    console.log('✓ isPartial correctly identifies partial DAGs');
  });

  test('partial DAG maintains root reference', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(testDir, `file${i}.txt`), `content ${i}`);
    }

    const fullDag = await createDag(testDir, false);
    const fileLeaves = Object.values(fullDag.Leafs).filter((leaf) => leaf.Type === LeafType.File);

    const partial = getPartial(fullDag, [fileLeaves[0].Hash, fileLeaves[1].Hash], false);

    expect(partial.Root).toBe(fullDag.Root);
    expect(partial.Leafs[partial.Root]).toBeDefined();

    console.log('✓ Partial DAG maintains root reference');
  });
});
