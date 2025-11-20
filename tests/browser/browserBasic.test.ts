/**
 * Browser-compatible tests using Vitest
 */

import { describe, test, expect } from 'vitest';
import { createDagFromFile, verifyDag, reconstructFile } from '../../src/browser';
import { BrowserMerkleTree } from '../../src/browserMerkleTree';
import { createCID, hashData } from '../../src/browserHash';

describe('Browser API', () => {
  test('creates DAG from small file', async () => {
    const fileName = 'test.txt';
    const content = new TextEncoder().encode('Hello, Browser World!');

    const dag = await createDagFromFile(fileName, content);

    expect(dag.Root).toBeDefined();
    expect(dag.Root.startsWith('bafi')).toBe(true);
    expect(Object.keys(dag.Leafs).length).toBeGreaterThan(0);

    await verifyDag(dag);
  });

  test('creates DAG from large file with chunking', async () => {
    const fileName = 'large.bin';
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const content = new Uint8Array(CHUNK_SIZE + 1000);
    for (let i = 0; i < content.length; i++) {
      content[i] = i % 256;
    }

    const dag = await createDagFromFile(fileName, content);

    expect(dag.Root).toBeDefined();

    // Should have chunks
    const chunks = Object.values(dag.Leafs).filter((leaf) => leaf.Type === 'chunk');
    expect(chunks.length).toBeGreaterThan(0);

    await verifyDag(dag);
  });

  test('reconstructs file from DAG', async () => {
    const fileName = 'reconstruct.txt';
    const original = new TextEncoder().encode('Test content for reconstruction');

    const dag = await createDagFromFile(fileName, original);
    const reconstructed = reconstructFile(dag);

    expect(reconstructed).toEqual(original);
  });

  test('handles empty file', async () => {
    const fileName = 'empty.txt';
    const content = new Uint8Array(0);

    const dag = await createDagFromFile(fileName, content);

    expect(dag.Root).toBeDefined();
    await verifyDag(dag);
  });

  test('BrowserMerkleTree works correctly', async () => {
    const leaves = [
      await hashData(new TextEncoder().encode('leaf1')),
      await hashData(new TextEncoder().encode('leaf2')),
      await hashData(new TextEncoder().encode('leaf3')),
    ];

    const tree = new BrowserMerkleTree(leaves);
    await tree.build();

    const root = tree.getRoot();
    expect(root).toBeDefined();
    expect(root.length).toBe(32);

    // Verify each leaf
    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      const isValid = await BrowserMerkleTree.verify(leaves[i], proof, root);
      expect(isValid).toBe(true);
    }
  });

  test('createCID produces valid CIDs', async () => {
    const testData = {
      ItemName: 'test.txt',
      Type: 'file',
      MerkleRoot: Buffer.alloc(0),
      CurrentLinkCount: 0,
      ContentHash: await hashData(new TextEncoder().encode('test content')),
      AdditionalData: [],
    };

    const cid = await createCID(testData);

    expect(cid).toBeDefined();
    expect(cid.startsWith('bafi')).toBe(true);
    expect(cid.length).toBeGreaterThan(20);
  });

  test('produces deterministic CIDs', async () => {
    const content = new TextEncoder().encode('deterministic content');

    const dag1 = await createDagFromFile('test.txt', content);
    const dag2 = await createDagFromFile('test.txt', content);

    expect(dag1.Root).toBe(dag2.Root);
  });

  test('handles Blob input', async () => {
    const blob = new Blob(['Blob content test'], { type: 'text/plain' });

    const dag = await createDagFromFile('blob.txt', blob);

    expect(dag.Root).toBeDefined();
    await verifyDag(dag);

    const reconstructed = reconstructFile(dag);
    const text = new TextDecoder().decode(reconstructed);
    expect(text).toBe('Blob content test');
  });
});
