import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag, verifyDag, createDirectory } from '../src/dag';
import { toCBOR, fromCBOR, toJSON, fromJSON, saveToFile, loadFromFile } from '../src/serialize';
import { LeafType } from '../src/types';

describe('DAG Creation and Verification', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scionic-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('creates DAG from single file', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'Hello, World!');

    const dag = await createDag(filePath);

    expect(dag.Root).toBeDefined();
    expect(dag.Root.startsWith('bafi')).toBe(true);
    expect(Object.keys(dag.Leafs).length).toBeGreaterThan(0);

    await verifyDag(dag);
  });

  test('creates DAG from directory', async () => {
    const inputDir = path.join(tempDir, 'input');
    fs.mkdirSync(inputDir);

    fs.writeFileSync(path.join(inputDir, 'file1.txt'), 'content 1');
    fs.writeFileSync(path.join(inputDir, 'file2.txt'), 'content 2');

    const dag = await createDag(inputDir);

    expect(dag.Root).toBeDefined();
    expect(Object.keys(dag.Leafs).length).toBeGreaterThan(2);

    const rootLeaf = dag.Leafs[dag.Root];
    expect(rootLeaf.Type).toBe(LeafType.Directory);

    await verifyDag(dag);
  });

  test('creates DAG with nested directories', async () => {
    const inputDir = path.join(tempDir, 'input');
    fs.mkdirSync(inputDir);

    const subdir = path.join(inputDir, 'subdir');
    fs.mkdirSync(subdir);

    fs.writeFileSync(path.join(inputDir, 'root.txt'), 'root content');
    fs.writeFileSync(path.join(subdir, 'nested.txt'), 'nested content');

    const dag = await createDag(inputDir);

    expect(dag.Root).toBeDefined();
    await verifyDag(dag);

    // Should have root dir, subdir, and 2 files
    expect(Object.keys(dag.Leafs).length).toBeGreaterThanOrEqual(4);
  });

  test('handles large files with chunking', async () => {
    const filePath = path.join(tempDir, 'large.txt');
    const chunkSize = 2 * 1024 * 1024; // 2MB
    const content = Buffer.alloc(chunkSize + 1000, 'X');
    fs.writeFileSync(filePath, content);

    const dag = await createDag(filePath);

    // Should have chunks
    const chunks = Object.values(dag.Leafs).filter(
      (leaf) => leaf.Type === LeafType.Chunk
    );
    expect(chunks.length).toBeGreaterThan(0);

    await verifyDag(dag);
  });

  test('adds timestamp when requested', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'content');

    const dag = await createDag(filePath, true);

    const rootLeaf = dag.Leafs[dag.Root];
    expect(rootLeaf.AdditionalData).toBeDefined();
    expect(rootLeaf.AdditionalData!.timestamp).toBeDefined();
  });

  test('serialization round-trip (CBOR)', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'test content');

    const dag = await createDag(filePath);
    const cbor = toCBOR(dag);

    expect(cbor).toBeInstanceOf(Uint8Array);
    expect(cbor.length).toBeGreaterThan(0);

    const restored = fromCBOR(cbor);

    expect(restored.Root).toBe(dag.Root);
    expect(Object.keys(restored.Leafs).length).toBe(Object.keys(dag.Leafs).length);

    await verifyDag(restored);
  });

  test('serialization round-trip (JSON)', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'test content');

    const dag = await createDag(filePath);
    const json = toJSON(dag);

    expect(typeof json).toBe('string');
    expect(json.length).toBeGreaterThan(0);

    const restored = fromJSON(json);

    expect(restored.Root).toBe(dag.Root);
    expect(Object.keys(restored.Leafs).length).toBe(Object.keys(dag.Leafs).length);

    await verifyDag(restored);
  });

  test('save and load from file', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'test content');

    const dag = await createDag(filePath);

    const dagFile = path.join(tempDir, 'test.dag');
    saveToFile(dag, dagFile);

    expect(fs.existsSync(dagFile)).toBe(true);

    const loaded = loadFromFile(dagFile);

    expect(loaded.Root).toBe(dag.Root);
    await verifyDag(loaded);
  });

  test('recreates directory from DAG', async () => {
    const inputDir = path.join(tempDir, 'input');
    fs.mkdirSync(inputDir);

    fs.writeFileSync(path.join(inputDir, 'file1.txt'), 'content 1');
    fs.writeFileSync(path.join(inputDir, 'file2.txt'), 'content 2');

    const subdir = path.join(inputDir, 'subdir');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'nested.txt'), 'nested content');

    const dag = await createDag(inputDir);

    const outputDir = path.join(tempDir, 'output');
    createDirectory(dag, outputDir);

    // Verify structure is recreated
    expect(fs.existsSync(path.join(outputDir, 'input', 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'input', 'file2.txt'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'input', 'subdir', 'nested.txt'))).toBe(true);

    // Verify content
    const content = fs.readFileSync(path.join(outputDir, 'input', 'file1.txt'), 'utf-8');
    expect(content).toBe('content 1');
  });

  test('produces deterministic CIDs', async () => {
    const dir1 = path.join(tempDir, 'dir1');
    const dir2 = path.join(tempDir, 'dir2');

    fs.mkdirSync(dir1);
    fs.mkdirSync(dir2);

    fs.writeFileSync(path.join(dir1, 'file.txt'), 'identical content');
    fs.writeFileSync(path.join(dir2, 'file.txt'), 'identical content');

    const dag1 = await createDag(dir1);
    const dag2 = await createDag(dir2);

    // File leaves should have identical hashes
    const fileLeaves1 = Object.values(dag1.Leafs).filter(
      (leaf) => leaf.Type === LeafType.File
    );
    const fileLeaves2 = Object.values(dag2.Leafs).filter(
      (leaf) => leaf.Type === LeafType.File
    );

    expect(fileLeaves1.length).toBe(fileLeaves2.length);
    expect(fileLeaves1[0].Hash).toBe(fileLeaves2[0].Hash);
  });

  test('CID format is correct', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'test');

    const dag = await createDag(filePath);

    // CID should start with "bafi" for CIDv1 with CBOR codec 0x51
    expect(dag.Root.startsWith('bafi')).toBe(true);

    // All leaf hashes should also start with "bafi"
    for (const hash of Object.keys(dag.Leafs)) {
      expect(hash.startsWith('bafi')).toBe(true);
    }
  });
});
