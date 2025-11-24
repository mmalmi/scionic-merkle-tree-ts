/**
 * Debug hash calculation differences
 */

import * as fs from 'fs';
import * as path from 'path';
import { runGoCommand } from './testHelpers';
import { createDag } from '../src/dag';
import { fromCBOR } from '../src/serialize';
import { createHash } from 'crypto';

const BITCOIN_PDF = path.join(__dirname, '..', 'bitcoin.pdf');

describe('Hash Calculation Debug', () => {
  test('compare content hashes for bitcoin.pdf', async () => {
    // Read the actual file
    const fileContent = fs.readFileSync(BITCOIN_PDF);
    console.log(`File size: ${fileContent.length} bytes`);

    // Calculate hash manually
    const manualHash = createHash('sha256').update(fileContent).digest();
    console.log(`Manual SHA256 hash: ${manualHash.toString('hex')}`);

    // TypeScript DAG
    const tsDag = await createDag(BITCOIN_PDF, false);
    const tsRoot = tsDag.Leafs[tsDag.Root];

    console.log('\nTypeScript Root:');
    console.log(`  Hash: ${tsRoot.Hash}`);
    console.log(`  ContentHash: ${tsRoot.ContentHash ? Buffer.from(tsRoot.ContentHash).toString('hex') : 'none'}`);
    console.log(`  Content length: ${tsRoot.Content ? tsRoot.Content.length : 0}`);
    console.log(`  Content matches file: ${tsRoot.Content ? Buffer.from(tsRoot.Content).equals(fileContent) : false}`);

    // Go DAG
    const tempDir = fs.mkdtempSync('/tmp/debug-hash-');
    const goPdfPath = path.join(tempDir, 'bitcoin.pdf');
    fs.copyFileSync(BITCOIN_PDF, goPdfPath);

    const goCborPath = path.join(tempDir, 'go.cbor');
    runGoCommand(`go run cmd/test_helper.go create "${goPdfPath}" "${goCborPath}"`);

    const goDag = fromCBOR(fs.readFileSync(goCborPath));
    const goRoot = goDag.Leafs[goDag.Root];

    console.log('\nGo Root:');
    console.log(`  Hash: ${goRoot.Hash}`);
    console.log(`  ContentHash: ${goRoot.ContentHash ? Buffer.from(goRoot.ContentHash).toString('hex') : 'none'}`);
    console.log(`  Content length: ${goRoot.Content ? goRoot.Content.length : 0}`);
    console.log(`  Content matches file: ${goRoot.Content ? Buffer.from(goRoot.Content).equals(fileContent) : false}`);

    console.log('\nComparison:');
    console.log(`  ContentHash match: ${tsRoot.ContentHash && goRoot.ContentHash ? Buffer.from(tsRoot.ContentHash).equals(Buffer.from(goRoot.ContentHash)) : false}`);
    console.log(`  Content match: ${tsRoot.Content && goRoot.Content ? Buffer.from(tsRoot.Content).equals(Buffer.from(goRoot.Content)) : false}`);

    // Compare with manual hash
    if (tsRoot.ContentHash) {
      console.log(`  TS ContentHash matches manual: ${Buffer.from(tsRoot.ContentHash).equals(manualHash)}`);
    }
    if (goRoot.ContentHash) {
      console.log(`  Go ContentHash matches manual: ${Buffer.from(goRoot.ContentHash).equals(manualHash)}`);
    }

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('analyze CBOR encoding differences', async () => {
    const tsDag = await createDag(BITCOIN_PDF, false);
    const tsRoot = tsDag.Leafs[tsDag.Root];

    console.log('\nTypeScript leaf data for hashing:');
    const tsLeafData = {
      ItemName: tsRoot.ItemName,
      Type: tsRoot.Type,
      MerkleRoot: tsRoot.ClassicMerkleRoot ? Array.from(tsRoot.ClassicMerkleRoot) : [],
      CurrentLinkCount: tsRoot.CurrentLinkCount,
      ContentHash: tsRoot.ContentHash ? Array.from(tsRoot.ContentHash) : null,
      AdditionalData: [],
      LeafCount: tsRoot.LeafCount,
      ContentSize: tsRoot.ContentSize,
      DagSize: tsRoot.DagSize,
    };

    console.log(JSON.stringify(tsLeafData, null, 2));

    // Encode and check size
    const cbor = require('cbor');
    const encoded = cbor.encode(tsLeafData);
    console.log(`\nCBOR encoded size: ${encoded.length} bytes`);
    console.log(`CBOR hex (first 100 bytes): ${encoded.slice(0, 100).toString('hex')}`);
  });
});
