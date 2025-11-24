/**
 * Debug directory DAG DagSize calculation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runGoCommand } from './testHelpers';
import { createDag } from '../src/dag';
import { fromCBOR, toCBOR } from '../src/serialize';

describe('Directory DAG DagSize Debug', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dagsize-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('compare directory DAG DagSize with Go', async () => {
    const inputDir = path.join(tempDir, 'input');
    fs.mkdirSync(inputDir);

    fs.writeFileSync(path.join(inputDir, 'file1.txt'), 'content from TS test 1');
    fs.writeFileSync(path.join(inputDir, 'file2.txt'), 'content from TS test 2');

    // TypeScript DAG
    const tsDag = await createDag(inputDir, false);
    const tsRoot = tsDag.Leafs[tsDag.Root];

    console.log('\nTypeScript DAG:');
    console.log(`  Root: ${tsDag.Root}`);
    console.log(`  Leaves: ${Object.keys(tsDag.Leafs).length}`);
    console.log(`  DagSize: ${tsRoot.DagSize}`);

    // Analyze leaf sizes
    const cbor = require('cbor');
    let calculatedSize = 0;
    for (const [hash, leaf] of Object.entries(tsDag.Leafs)) {
      if (hash === tsDag.Root) continue;

      const leafForSize = {
        Hash: leaf.Hash,
        ItemName: leaf.ItemName,
        Type: leaf.Type,
        ContentHash: leaf.ContentHash ? Buffer.from(leaf.ContentHash) : null,
        Content: leaf.Content ? Buffer.from(leaf.Content) : null,
        ClassicMerkleRoot: leaf.ClassicMerkleRoot ? Buffer.from(leaf.ClassicMerkleRoot) : Buffer.alloc(0),
        CurrentLinkCount: leaf.CurrentLinkCount,
        LeafCount: leaf.LeafCount || 0,
        ContentSize: leaf.ContentSize || 0,
        DagSize: leaf.DagSize || 0,
        Links: leaf.Links ? [...leaf.Links].sort() : [],
        AdditionalData: leaf.AdditionalData || {},
      };

      const leafCbor = cbor.encode(leafForSize);
      console.log(`  Child ${leaf.ItemName}: ${leafCbor.length} bytes`);
      calculatedSize += leafCbor.length;
    }

    // Calculate root size
    const tempRootForSize = {
      ItemName: tsRoot.ItemName,
      Type: tsRoot.Type,
      MerkleRoot: tsRoot.ClassicMerkleRoot ? Buffer.from(tsRoot.ClassicMerkleRoot) : Buffer.alloc(0),
      CurrentLinkCount: tsRoot.CurrentLinkCount,
      LeafCount: tsRoot.LeafCount,
      ContentSize: tsRoot.ContentSize,
      DagSize: 0,
      ContentHash: tsRoot.ContentHash ? Buffer.from(tsRoot.ContentHash) : null,
      AdditionalData: [],
    };

    const rootCbor = cbor.encode(tempRootForSize);
    console.log(`  Root temp size: ${rootCbor.length} bytes`);

    calculatedSize += rootCbor.length;
    console.log(`  Total calculated: ${calculatedSize}`);
    console.log(`  Stored DagSize: ${tsRoot.DagSize}`);
    console.log(`  Difference: ${Math.abs(calculatedSize - (tsRoot.DagSize || 0))}`);

    // Go DAG
    const goCborPath = path.join(tempDir, 'go.cbor');
    const output = runGoCommand(`go run cmd/test_helper.go create "${inputDir}" "${goCborPath}"`);

    console.log('\nGo DAG:', output.trim());

    const goDag = fromCBOR(fs.readFileSync(goCborPath));
    const goRoot = goDag.Leafs[goDag.Root];

    console.log(`  DagSize: ${goRoot.DagSize}`);
    console.log(`\nComparison:`);
    console.log(`  TS DagSize: ${tsRoot.DagSize}`);
    console.log(`  Go DagSize: ${goRoot.DagSize}`);
    console.log(`  Difference: ${Math.abs((tsRoot.DagSize || 0) - (goRoot.DagSize || 0))} bytes`);
  });
});
