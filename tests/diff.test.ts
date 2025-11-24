/**
 * Tests for DAG diff functionality
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag } from '../src/dag';
import {
  diff,
  diffFromNewLeaves,
  applyDiffToDag,
  getAddedLeaves,
  getRemovedLeaves,
  DiffType,
} from '../src/diff';

describe('DAG Diff', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('identical DAGs have no differences', async () => {
    const dir = path.join(tempDir, 'test');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'file.txt'), 'content');

    const dag1 = await createDag(dir, false);
    const dag2 = await createDag(dir, false);

    const result = diff(dag1, dag2);

    expect(result.summary.total).toBe(0);
    expect(result.summary.added).toBe(0);
    expect(result.summary.removed).toBe(0);
  });

  test('detects added leaves', async () => {
    // Create small DAG
    const dir1 = path.join(tempDir, 'small');
    fs.mkdirSync(dir1);
    fs.writeFileSync(path.join(dir1, 'file1.txt'), 'content1');
    const dag1 = await createDag(dir1, false);

    // Create larger DAG
    const dir2 = path.join(tempDir, 'large');
    fs.mkdirSync(dir2);
    fs.writeFileSync(path.join(dir2, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(dir2, 'file2.txt'), 'content2');
    const dag2 = await createDag(dir2, false);

    const result = diff(dag1, dag2);

    expect(result.summary.added).toBeGreaterThan(0);
  });

  test('detects removed leaves', async () => {
    // Create larger DAG
    const dir1 = path.join(tempDir, 'large');
    fs.mkdirSync(dir1);
    fs.writeFileSync(path.join(dir1, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(dir1, 'file2.txt'), 'content2');
    const dag1 = await createDag(dir1, false);

    // Create smaller DAG
    const dir2 = path.join(tempDir, 'small');
    fs.mkdirSync(dir2);
    fs.writeFileSync(path.join(dir2, 'file1.txt'), 'content1');
    const dag2 = await createDag(dir2, false);

    const result = diff(dag1, dag2);

    expect(result.summary.removed).toBeGreaterThan(0);
  });

  test('modified content shows as add + remove', async () => {
    const dir = path.join(tempDir, 'test');
    fs.mkdirSync(dir);

    // Create first DAG
    fs.writeFileSync(path.join(dir, 'file.txt'), 'original content');
    const dag1 = await createDag(dir, false);

    // Modify and create second DAG
    fs.writeFileSync(path.join(dir, 'file.txt'), 'modified content');
    const dag2 = await createDag(dir, false);

    const result = diff(dag1, dag2);

    // Modified = removal + addition in content-addressed systems
    expect(result.summary.added).toBeGreaterThan(0);
    expect(result.summary.removed).toBeGreaterThan(0);
  });

  test('getAddedLeaves returns correct leaves', async () => {
    const dir1 = path.join(tempDir, 'dir1');
    fs.mkdirSync(dir1);
    fs.writeFileSync(path.join(dir1, 'file1.txt'), 'content1');
    const dag1 = await createDag(dir1, false);

    const dir2 = path.join(tempDir, 'dir2');
    fs.mkdirSync(dir2);
    fs.writeFileSync(path.join(dir2, 'file2.txt'), 'content2');
    const dag2 = await createDag(dir2, false);

    const result = diff(dag1, dag2);
    const added = getAddedLeaves(result);
    const removed = getRemovedLeaves(result);

    expect(Object.keys(added).length).toBe(result.summary.added);
    expect(Object.keys(removed).length).toBe(result.summary.removed);

    // All added should have DiffType.Added
    for (const [hash, leafDiff] of Object.entries(result.diffs)) {
      if (leafDiff.type === DiffType.Added) {
        expect(added[hash]).toBeDefined();
      }
    }
  });

  test('complex changes with add, remove, modify', async () => {
    // Create first structure
    const dir1 = path.join(tempDir, 'dir1');
    fs.mkdirSync(dir1);
    fs.mkdirSync(path.join(dir1, 'subdir'));
    fs.writeFileSync(path.join(dir1, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(dir1, 'file2.txt'), 'content2');
    fs.writeFileSync(path.join(dir1, 'subdir', 'file3.txt'), 'content3');
    const dag1 = await createDag(dir1, false);

    // Create second structure with changes
    const dir2 = path.join(tempDir, 'dir2');
    fs.mkdirSync(dir2);
    fs.mkdirSync(path.join(dir2, 'subdir'));
    fs.writeFileSync(path.join(dir2, 'file1.txt'), 'content1'); // unchanged
    fs.writeFileSync(path.join(dir2, 'file2.txt'), 'MODIFIED content2'); // modified
    // file3.txt removed
    fs.writeFileSync(path.join(dir2, 'file4.txt'), 'new content4'); // added
    const dag2 = await createDag(dir2, false);

    const result = diff(dag1, dag2);

    // Should have both additions and removals
    expect(result.summary.added).toBeGreaterThan(0);
    expect(result.summary.removed).toBeGreaterThan(0);
    expect(result.summary.total).toBe(result.summary.added + result.summary.removed);

    console.log(`Complex diff: added=${result.summary.added}, removed=${result.summary.removed}`);
  });

  test('applyDiffToDag reconstructs new DAG', async () => {
    const dir1 = path.join(tempDir, 'dir1');
    fs.mkdirSync(dir1);
    fs.writeFileSync(path.join(dir1, 'file1.txt'), 'content1');
    const dag1 = await createDag(dir1, false);

    const dir2 = path.join(tempDir, 'dir2');
    fs.mkdirSync(dir2);
    fs.writeFileSync(path.join(dir2, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(dir2, 'file2.txt'), 'content2');
    const dag2 = await createDag(dir2, false);

    const dagDiff = diff(dag1, dag2);
    const reconstructed = applyDiffToDag(dagDiff, dag1);

    // Reconstructed should have same root as dag2
    expect(reconstructed.Root).toBe(dag2.Root);
    expect(Object.keys(reconstructed.Leafs).length).toBe(Object.keys(dag2.Leafs).length);
  });

  test('diffFromNewLeaves identifies reachability', async () => {
    const dir1 = path.join(tempDir, 'dir1');
    fs.mkdirSync(dir1);
    fs.writeFileSync(path.join(dir1, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(dir1, 'file2.txt'), 'content2');
    const dag1 = await createDag(dir1, false);

    const dir2 = path.join(tempDir, 'dir2');
    fs.mkdirSync(dir2);
    fs.writeFileSync(path.join(dir2, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(dir2, 'file3.txt'), 'content3'); // different file
    const dag2 = await createDag(dir2, false);

    const result = diffFromNewLeaves(dag1, dag2.Leafs);

    // Should detect file2 removal and file3 addition
    expect(result.summary.added).toBeGreaterThan(0);
    expect(result.summary.removed).toBeGreaterThan(0);
  });
});
