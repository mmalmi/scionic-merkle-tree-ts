/**
 * Tests for Labels/LeafSync protocol
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag } from '../src/dag';
import {
  calculateLabels,
  clearLabels,
  getHashesByLabelRange,
  getLabel,
  getHashByLabel,
} from '../src/labels';

describe('Labels and LeafSync Protocol', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labels-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('calculateLabels assigns labels deterministically', async () => {
    // Create test directory
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'a.txt'), 'content a');
    fs.writeFileSync(path.join(testDir, 'b.txt'), 'content b');
    fs.writeFileSync(path.join(testDir, 'c.txt'), 'content c');

    const dag = await createDag(testDir, false);

    // Calculate labels
    const count = await calculateLabels(dag);

    console.log(`Assigned ${count} labels`);
    expect(count).toBeGreaterThan(0);
    expect(dag.Labels).toBeDefined();
    expect(Object.keys(dag.Labels!).length).toBe(count);
  });

  test('labels are deterministic across multiple calculations', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content 1');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content 2');

    const dag = await createDag(testDir, false);

    // Calculate labels multiple times
    await calculateLabels(dag);
    const labels1 = { ...dag.Labels };

    await calculateLabels(dag);
    const labels2 = { ...dag.Labels };

    await calculateLabels(dag);
    const labels3 = { ...dag.Labels };

    // All should be identical
    expect(labels1).toEqual(labels2);
    expect(labels2).toEqual(labels3);

    console.log('Labels are deterministic across multiple calculations');
  });

  test('clearLabels removes all labels', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'a.txt'), 'content a');
    fs.writeFileSync(path.join(tempDir, 'b.txt'), 'content b');

    const dag = await createDag(testDir, false);
    await calculateLabels(dag);

    expect(Object.keys(dag.Labels!).length).toBeGreaterThan(0);

    clearLabels(dag);

    expect(dag.Labels).toBeDefined();
    expect(Object.keys(dag.Labels!).length).toBe(0);
  });

  test('getHashesByLabelRange returns correct hashes', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    // Create 5 files
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(testDir, `file${i}.txt`), `content ${i}`);
    }

    const dag = await createDag(testDir, false);
    const count = await calculateLabels(dag);

    console.log(`Total labels: ${count}`);

    // Get first 3 labels
    const hashes = getHashesByLabelRange(dag, 1, Math.min(3, count));

    expect(hashes.length).toBe(Math.min(3, count));
    expect(hashes.every((h) => typeof h === 'string' && h.startsWith('bafi'))).toBe(true);

    console.log(`Retrieved ${hashes.length} hashes for labels 1-${Math.min(3, count)}`);
  });

  test('getHashesByLabelRange validates input', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'a.txt'), 'content a');
    fs.writeFileSync(path.join(testDir, 'b.txt'), 'content b');

    const dag = await createDag(testDir, false);

    // Should throw before labels are calculated
    expect(() => getHashesByLabelRange(dag, 1, 5)).toThrow('Labels not calculated');

    await calculateLabels(dag);

    // Should throw for start < 1
    expect(() => getHashesByLabelRange(dag, 0, 5)).toThrow('Start label must be >= 1');

    // Should throw for end < start
    expect(() => getHashesByLabelRange(dag, 5, 3)).toThrow('End label');

    // Should throw for end > available labels
    const count = Object.keys(dag.Labels!).length;
    expect(() => getHashesByLabelRange(dag, 1, count + 10)).toThrow('exceeds available labels');
  });

  test('getLabel returns correct label for hash', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file.txt'), 'content');

    const dag = await createDag(testDir, false);
    await calculateLabels(dag);

    // Root should be label "0"
    const rootLabel = getLabel(dag, dag.Root);
    expect(rootLabel).toBe('0');

    // Other leaves should have numeric labels
    for (const [label, hash] of Object.entries(dag.Labels!)) {
      const retrievedLabel = getLabel(dag, hash);
      expect(retrievedLabel).toBe(label);
    }
  });

  test('getLabel throws for non-existent hash', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file.txt'), 'content');

    const dag = await createDag(testDir, false);
    await calculateLabels(dag);

    expect(() => getLabel(dag, 'bafireinonexistenthash')).toThrow('not found in labels');
  });

  test('getHashByLabel returns correct hash', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file.txt'), 'content');

    const dag = await createDag(testDir, false);
    await calculateLabels(dag);

    // Label "0" should return root
    const rootHash = getHashByLabel(dag, '0');
    expect(rootHash).toBe(dag.Root);

    // Other labels should return their hashes
    for (const [label, hash] of Object.entries(dag.Labels!)) {
      const retrievedHash = getHashByLabel(dag, label);
      expect(retrievedHash).toBe(hash);
    }
  });

  test('labels persist through serialization', async () => {
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'content');

    const dag = await createDag(testFile, false);
    await calculateLabels(dag);

    const originalLabels = { ...dag.Labels };

    // Serialize and deserialize
    const { toCBOR, fromCBOR } = require('../src/serialize');
    const cbor = toCBOR(dag);
    const restored = fromCBOR(cbor);

    expect(restored.Labels).toEqual(originalLabels);
    console.log('✓ Labels persist through CBOR serialization');
  });

  test('label range query works on large DAG', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    // Create 20 files
    for (let i = 0; i < 20; i++) {
      fs.writeFileSync(path.join(testDir, `file${i}.txt`), `content ${i}`);
    }

    const dag = await createDag(testDir, false);
    const count = await calculateLabels(dag);

    console.log(`Created DAG with ${count} labeled leaves`);

    // Request middle range
    const start = Math.floor(count / 3);
    const end = Math.floor((2 * count) / 3);

    if (start >= 1 && end <= count && end >= start) {
      const hashes = getHashesByLabelRange(dag, start, end);
      const expectedCount = end - start + 1;

      expect(hashes.length).toBe(expectedCount);
      console.log(`✓ Retrieved ${hashes.length} hashes for labels ${start}-${end}`);
    }
  });
});
