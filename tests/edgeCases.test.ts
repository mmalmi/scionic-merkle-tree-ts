/**
 * Edge case tests for robustness
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag, verifyDag, createDirectory } from '../src/dag';
import { fromCBOR, toCBOR } from '../src/serialize';
import { LeafType } from '../src/types';

describe('Edge Cases', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('handles empty file', async () => {
    const emptyFile = path.join(tempDir, 'empty.txt');
    fs.writeFileSync(emptyFile, '');

    const dag = await createDag(emptyFile, false);

    expect(dag.Root).toBeDefined();
    await verifyDag(dag);

    const rootLeaf = dag.Leafs[dag.Root];
    expect(rootLeaf.Content).toBeDefined();
    expect(rootLeaf.Content!.length).toBe(0);

    console.log('✓ Empty file handled correctly');
  });

  test('handles empty directory', async () => {
    const emptyDir = path.join(tempDir, 'empty');
    fs.mkdirSync(emptyDir);

    const dag = await createDag(emptyDir, false);

    expect(dag.Root).toBeDefined();
    await verifyDag(dag);

    const rootLeaf = dag.Leafs[dag.Root];
    expect(rootLeaf.Type).toBe(LeafType.Directory);
    expect(rootLeaf.CurrentLinkCount).toBe(0);

    console.log('✓ Empty directory handled correctly');
  });

  test('handles special characters in filenames', async () => {
    const specialNames = [
      'file with spaces.txt',
      'file-with-dashes.txt',
      'file_with_underscores.txt',
      'file.multiple.dots.txt',
    ];

    const testDir = path.join(tempDir, 'special');
    fs.mkdirSync(testDir);

    for (const name of specialNames) {
      fs.writeFileSync(path.join(testDir, name), `content for ${name}`);
    }

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    // Verify all files are included
    const fileLeaves = Object.values(dag.Leafs).filter((leaf) => leaf.Type === LeafType.File);
    expect(fileLeaves.length).toBe(specialNames.length);

    console.log('✓ Special characters in filenames handled correctly');
  });

  test('handles unicode filenames', async () => {
    const unicodeNames = [
      'emoji😀.txt',
      'chinese中文.txt',
      'japanese日本語.txt',
    ];

    const testDir = path.join(tempDir, 'unicode');
    fs.mkdirSync(testDir);

    for (const name of unicodeNames) {
      fs.writeFileSync(path.join(testDir, name), `content for ${name}`);
    }

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    const fileLeaves = Object.values(dag.Leafs).filter((leaf) => leaf.Type === LeafType.File);
    expect(fileLeaves.length).toBe(unicodeNames.length);

    console.log('✓ Unicode filenames handled correctly');
  });

  test('handles very small files', async () => {
    const testDir = path.join(tempDir, 'small');
    fs.mkdirSync(testDir);

    fs.writeFileSync(path.join(testDir, 'one-byte.txt'), 'a');
    fs.writeFileSync(path.join(testDir, 'two-bytes.txt'), 'ab');

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    console.log('✓ Very small files handled correctly');
  });

  test('handles nested empty directories', async () => {
    const testDir = path.join(tempDir, 'nested');
    fs.mkdirSync(testDir);

    const level1 = path.join(testDir, 'level1');
    fs.mkdirSync(level1);

    const level2 = path.join(level1, 'level2');
    fs.mkdirSync(level2);

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    // Should have 3 directories
    const dirs = Object.values(dag.Leafs).filter((leaf) => leaf.Type === LeafType.Directory);
    expect(dirs.length).toBe(3);

    console.log('✓ Nested empty directories handled correctly');
  });

  test('handles mixed empty and non-empty directories', async () => {
    const testDir = path.join(tempDir, 'mixed');
    fs.mkdirSync(testDir);

    const emptyDir = path.join(testDir, 'empty');
    fs.mkdirSync(emptyDir);

    const fullDir = path.join(testDir, 'full');
    fs.mkdirSync(fullDir);
    fs.writeFileSync(path.join(fullDir, 'file.txt'), 'content');

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    console.log('✓ Mixed empty and non-empty directories handled correctly');
  });

  test('rejects invalid CBOR data', () => {
    const invalidCBOR = new Uint8Array([0xff, 0xff, 0xff, 0xff]);

    expect(() => fromCBOR(invalidCBOR)).toThrow();
    console.log('✓ Invalid CBOR rejected');
  });

  test('handles single large file at chunk boundary', async () => {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const exactSize = CHUNK_SIZE; // Exactly one chunk

    const largefile = path.join(tempDir, 'exact-chunk.bin');
    const content = Buffer.alloc(exactSize, 'X');
    fs.writeFileSync(largefile, content);

    const dag = await createDag(largefile, false);
    await verifyDag(dag);

    // Should not create chunks since it's exactly at the boundary
    const chunks = Object.values(dag.Leafs).filter((leaf) => leaf.Type === LeafType.Chunk);
    expect(chunks.length).toBe(0);

    console.log('✓ File at exact chunk boundary handled correctly');
  });

  test('handles multiple chunk boundaries', async () => {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const size = CHUNK_SIZE * 2 + 100; // 2.something chunks

    const largefile = path.join(tempDir, 'multi-chunk.bin');
    const content = Buffer.alloc(size, 'X');
    fs.writeFileSync(largefile, content);

    const dag = await createDag(largefile, false);
    await verifyDag(dag);

    // Should create chunks
    const chunks = Object.values(dag.Leafs).filter((leaf) => leaf.Type === LeafType.Chunk);
    expect(chunks.length).toBe(3); // 3 chunks

    // Reconstruct and verify
    const outputDir = path.join(tempDir, 'reconstructed');
    createDirectory(dag, outputDir);

    const reconstructedPath = path.join(outputDir, 'multi-chunk.bin');
    const reconstructedContent = fs.readFileSync(reconstructedPath);

    expect(reconstructedContent.length).toBe(size);
    expect(reconstructedContent.equals(content)).toBe(true);

    console.log('✓ Multiple chunks handled and reconstructed correctly');
  });

  test('deep directory hierarchy', async () => {
    const testDir = path.join(tempDir, 'deep');
    fs.mkdirSync(testDir);

    // Create 10-level deep hierarchy
    let currentDir = testDir;
    for (let i = 0; i < 10; i++) {
      currentDir = path.join(currentDir, `level${i}`);
      fs.mkdirSync(currentDir);
    }

    // Add file at the deepest level
    fs.writeFileSync(path.join(currentDir, 'deep-file.txt'), 'deep content');

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    // Should have 11 directories (root + 10 levels) + 1 file
    expect(Object.keys(dag.Leafs).length).toBe(12);

    console.log('✓ Deep directory hierarchy handled correctly');
  });

  test('many files in single directory', async () => {
    const testDir = path.join(tempDir, 'many');
    fs.mkdirSync(testDir);

    // Create 100 files
    for (let i = 0; i < 100; i++) {
      fs.writeFileSync(path.join(testDir, `file${i}.txt`), `content ${i}`);
    }

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    const fileLeaves = Object.values(dag.Leafs).filter((leaf) => leaf.Type === LeafType.File);
    expect(fileLeaves.length).toBe(100);

    console.log('✓ Many files in single directory handled correctly');
  });

  test('handles file with no extension', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    fs.writeFileSync(path.join(testDir, 'README'), 'readme content');
    fs.writeFileSync(path.join(testDir, 'Makefile'), 'makefile content');

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    const fileLeaves = Object.values(dag.Leafs).filter((leaf) => leaf.Type === LeafType.File);
    expect(fileLeaves.length).toBe(2);

    console.log('✓ Files without extension handled correctly');
  });

  test('handles binary files', async () => {
    const testDir = path.join(tempDir, 'binary');
    fs.mkdirSync(testDir);

    // Create binary file with various byte values
    const binaryData = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      binaryData[i] = i;
    }

    fs.writeFileSync(path.join(testDir, 'binary.bin'), binaryData);

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    // Reconstruct and verify binary integrity
    const outputDir = path.join(tempDir, 'output');
    createDirectory(dag, outputDir);

    const reconstructed = fs.readFileSync(path.join(outputDir, 'binary', 'binary.bin'));
    expect(Buffer.from(reconstructed).equals(Buffer.from(binaryData))).toBe(true);

    console.log('✓ Binary files handled correctly');
  });

  test('serialization handles edge case data', async () => {
    const testFile = path.join(tempDir, 'edge.txt');
    fs.writeFileSync(testFile, '');

    const dag = await createDag(testFile, false);

    // CBOR round-trip
    const cbor = toCBOR(dag);
    const restored = fromCBOR(cbor);

    expect(restored.Root).toBe(dag.Root);
    await verifyDag(restored);

    console.log('✓ Serialization handles edge cases correctly');
  });

  test('handles paths with dots', async () => {
    const testDir = path.join(tempDir, 'test.dir');
    fs.mkdirSync(testDir);

    const subdir = path.join(testDir, 'sub.dir');
    fs.mkdirSync(subdir);

    fs.writeFileSync(path.join(subdir, 'file.with.dots.txt'), 'content');

    const dag = await createDag(testDir, false);
    await verifyDag(dag);

    console.log('✓ Paths with dots handled correctly');
  });
});
