/**
 * Tests for Transmission Protocol
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag } from '../src/dag';
import {
  getLeafSequence,
  applyAndVerifyTransmissionPacket,
} from '../src/transmission';
import { Dag } from '../src/types';

describe('Transmission Protocol', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transmission-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getLeafSequence generates packets in BFS order', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content 1');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content 2');

    const dag = await createDag(testDir, false);
    const sequence = getLeafSequence(dag);

    expect(sequence.length).toBeGreaterThan(0);
    expect(sequence[0].ParentHash).toBe(''); // First packet is root
    expect(sequence[0].Leaf.Hash).toBe(dag.Root);

    console.log(`Generated ${sequence.length} transmission packets`);
  });

  test('leaf-by-leaf transmission reconstructs DAG', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content 1');
    fs.writeFileSync(path.join(testDir, 'file2.txt'), 'content 2');

    const subdir = path.join(testDir, 'subdir');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'nested.txt'), 'nested content');

    const originalDag = await createDag(testDir, false);
    const sequence = getLeafSequence(originalDag);

    console.log(`Original DAG: ${Object.keys(originalDag.Leafs).length} leaves`);
    console.log(`Transmission: ${sequence.length} packets`);

    // Create empty receiver DAG
    const receiverDag: Dag = {
      Root: originalDag.Root,
      Leafs: {},
    };

    // Apply each packet
    for (let i = 0; i < sequence.length; i++) {
      const packet = sequence[i];
      await applyAndVerifyTransmissionPacket(receiverDag, packet);
    }

    console.log(`Receiver DAG: ${Object.keys(receiverDag.Leafs).length} leaves`);

    // Verify receiver has all leaves
    expect(Object.keys(receiverDag.Leafs).length).toBe(Object.keys(originalDag.Leafs).length);

    // Verify the reconstructed DAG
    const { verifyDag } = require('../src/dag');
    await verifyDag(receiverDag);

    console.log('✓ DAG successfully reconstructed from transmission packets');
  });

  test('packet serialization round-trip', async () => {
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    const dag = await createDag(testFile, false);
    const sequence = getLeafSequence(dag);

    expect(sequence.length).toBeGreaterThan(0);

    // Serialize and deserialize each packet
    const cbor = require('cbor');
    for (const packet of sequence) {
      const serialized = cbor.encode(packet);
      const deserialized = cbor.decode(serialized);

      expect(deserialized.Leaf.Hash).toBe(packet.Leaf.Hash);
      expect(deserialized.ParentHash).toBe(packet.ParentHash);
    }

    console.log('✓ Packet serialization round-trip successful');
  });

  test('transmission works for single file', async () => {
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'single file content');

    const originalDag = await createDag(testFile, false);
    const sequence = getLeafSequence(originalDag);

    // Single file should have 1 packet (just the root)
    expect(sequence.length).toBe(1);
    expect(sequence[0].ParentHash).toBe('');

    // Reconstruct
    const receiverDag: Dag = {
      Root: originalDag.Root,
      Leafs: {},
    };

    await applyAndVerifyTransmissionPacket(receiverDag, sequence[0]);

    expect(Object.keys(receiverDag.Leafs).length).toBe(1);
    console.log('✓ Single file transmission successful');
  });

  test('transmission preserves links', async () => {
    const testDir = path.join(tempDir, 'test');
    fs.mkdirSync(testDir);

    for (let i = 0; i < 3; i++) {
      fs.writeFileSync(path.join(testDir, `file${i}.txt`), `content ${i}`);
    }

    const originalDag = await createDag(testDir, false);
    const sequence = getLeafSequence(originalDag);

    // Reconstruct
    const receiverDag: Dag = {
      Root: originalDag.Root,
      Leafs: {},
    };

    for (const packet of sequence) {
      await applyAndVerifyTransmissionPacket(receiverDag, packet);
    }

    // Verify links are preserved
    const originalRoot = originalDag.Leafs[originalDag.Root];
    const receiverRoot = receiverDag.Leafs[receiverDag.Root];

    expect(receiverRoot.Links).toBeDefined();
    expect(receiverRoot.Links!.length).toBe(originalRoot.Links!.length);

    console.log('✓ Links preserved through transmission');
  });
});
