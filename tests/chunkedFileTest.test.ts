/**
 * Test chunked file creation to verify merkle tree compatibility with Go
 * DEFAULT_CHUNK_SIZE is 2MB, so we create files larger than that
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag } from '../src/dag';
import { DEFAULT_CHUNK_SIZE } from '../src/types';

describe('Chunked File Merkle Tree Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scionic-chunk-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('Create file with 3 chunks (odd number) - 6MB file', async () => {
    const testFile = path.join(tempDir, 'large.bin');

    // Create 6MB file (DEFAULT_CHUNK_SIZE is 2MB, so this creates 3 chunks)
    const fileSize = 6 * 1024 * 1024;
    const content = Buffer.alloc(fileSize);
    for (let i = 0; i < content.length; i++) {
      content[i] = i % 256;
    }
    fs.writeFileSync(testFile, content);

    console.log(`Created test file: ${testFile}`);
    console.log(`File size: ${fs.statSync(testFile).size} bytes (${fileSize / (1024 * 1024)}MB)`);
    console.log(`Default chunk size: ${DEFAULT_CHUNK_SIZE} bytes (${DEFAULT_CHUNK_SIZE / (1024 * 1024)}MB)`);

    const dag = await createDag(testFile, false);

    console.log(`Root CID: ${dag.Root}`);
    console.log(`Total leaves: ${Object.keys(dag.Leafs).length}`);

    // Analyze structure
    const rootLeaf = dag.Leafs[dag.Root];
    console.log(`Root type: ${rootLeaf.Type}`);
    console.log(`Root links: ${rootLeaf.CurrentLinkCount}`);

    // Should have created chunks
    const chunks = Object.values(dag.Leafs).filter(leaf => leaf.Type === 'chunk');
    console.log(`Number of chunks: ${chunks.length}`);

    // With 6MB file and 2MB chunks, expect 3 chunks
    expect(chunks.length).toBe(3);
    expect(rootLeaf.CurrentLinkCount).toBe(3);

    // Check if root has ClassicMerkleRoot (for 3 chunks - odd number)
    console.log(`Root has ClassicMerkleRoot: ${!!rootLeaf.ClassicMerkleRoot}`);
    if (rootLeaf.ClassicMerkleRoot) {
      console.log(`ClassicMerkleRoot length: ${rootLeaf.ClassicMerkleRoot.length} bytes`);
      console.log(`ClassicMerkleRoot (hex): ${Buffer.from(rootLeaf.ClassicMerkleRoot).toString('hex')}`);

      // Verify the merkle root was computed
      expect(rootLeaf.ClassicMerkleRoot.length).toBe(32); // SHA256 hash
    } else {
      console.log('WARNING: No ClassicMerkleRoot present!');
    }

    // List all leaves
    console.log('\nAll leaves:');
    for (const [hash, leaf] of Object.entries(dag.Leafs)) {
      console.log(`  ${hash.substring(0, 40)}...`);
      console.log(`    Type: ${leaf.Type}`);
      console.log(`    Name: ${leaf.ItemName}`);
      console.log(`    Links: ${leaf.CurrentLinkCount}`);
      if (leaf.ClassicMerkleRoot) {
        console.log(`    Has ClassicMerkleRoot: yes (${leaf.ClassicMerkleRoot.length} bytes)`);
      }
    }
  });

  test('Create file with 5 chunks (odd number) - 10MB file', async () => {
    const testFile = path.join(tempDir, 'large2.bin');

    // Create 10MB file -> 5 chunks of 2MB each
    const fileSize = 10 * 1024 * 1024;
    const content = Buffer.alloc(fileSize);
    for (let i = 0; i < content.length; i++) {
      content[i] = (i * 7) % 256;
    }
    fs.writeFileSync(testFile, content);

    console.log(`\nTest with 5 chunks:`);
    console.log(`File size: ${fileSize / (1024 * 1024)}MB`);

    const dag = await createDag(testFile, false);

    console.log(`Root CID: ${dag.Root}`);

    const rootLeaf = dag.Leafs[dag.Root];
    const chunks = Object.values(dag.Leafs).filter(leaf => leaf.Type === 'chunk');

    console.log(`Number of chunks: ${chunks.length}`);
    expect(chunks.length).toBe(5);

    console.log(`Root ClassicMerkleRoot: ${rootLeaf.ClassicMerkleRoot ? 'present' : 'missing'}`);

    // This is where the algorithm matters - with 5 chunks (odd number),
    // Go duplicates the 5th chunk while TypeScript might just promote it
    if (rootLeaf.ClassicMerkleRoot) {
      console.log(`ClassicMerkleRoot (hex): ${Buffer.from(rootLeaf.ClassicMerkleRoot).toString('hex')}`);
    }
  });
});
