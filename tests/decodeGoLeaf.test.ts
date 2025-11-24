/**
 * Decode Go's leaf to see exact structure
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runGoCommand } from './testHelpers';
import { fromCBOR } from '../src/serialize';

describe('Decode Go Leaf', () => {
  test('decode Go file1.txt leaf structure', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'decode-test-'));

    const inputDir = path.join(tempDir, 'input');
    fs.mkdirSync(inputDir);

    fs.writeFileSync(path.join(inputDir, 'file1.txt'), 'content from test 1');
    fs.writeFileSync(path.join(inputDir, 'file2.txt'), 'content from test 2');

    // Create with Go
    const goCborPath = path.join(tempDir, 'go.cbor');
    runGoCommand(`go run cmd/test_helper.go create "${inputDir}" "${goCborPath}"`);

    const goDag = fromCBOR(fs.readFileSync(goCborPath));

    // Find file1.txt leaf
    const file1Leaf = Object.values(goDag.Leafs).find((leaf) => leaf.ItemName === 'file1.txt');
    console.log('\nGo file1.txt leaf:');
    console.log(JSON.stringify(file1Leaf, (key, value) => {
      if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        if (value.length === 32) {
          return Buffer.from(value).toString('hex');
        }
        return `<${value.length} bytes>`;
      }
      return value;
    }, 2));

    // Try to recreate the leaf data for hashing
    const cbor = require('cbor');
    const crypto = require('crypto');

    // Test different structures
    const structures = [
      {
        name: 'With AdditionalData: null',
        data: {
          ItemName: file1Leaf!.ItemName,
          Type: file1Leaf!.Type,
          MerkleRoot: file1Leaf!.ClassicMerkleRoot ? Buffer.from(file1Leaf!.ClassicMerkleRoot) : Buffer.alloc(0),
          CurrentLinkCount: file1Leaf!.CurrentLinkCount,
          ContentHash: file1Leaf!.ContentHash ? Buffer.from(file1Leaf!.ContentHash) : null,
          AdditionalData: null,
        },
      },
      {
        name: 'With AdditionalData: []',
        data: {
          ItemName: file1Leaf!.ItemName,
          Type: file1Leaf!.Type,
          MerkleRoot: file1Leaf!.ClassicMerkleRoot ? Buffer.from(file1Leaf!.ClassicMerkleRoot) : Buffer.alloc(0),
          CurrentLinkCount: file1Leaf!.CurrentLinkCount,
          ContentHash: file1Leaf!.ContentHash ? Buffer.from(file1Leaf!.ContentHash) : null,
          AdditionalData: [],
        },
      },
    ];

    for (const test of structures) {
      const encoded = cbor.encode(test.data);
      const hash = crypto.createHash('sha256').update(encoded).digest();
      const cidBytes = Buffer.concat([Buffer.from([0x01, 0x51, 0x12, 0x20]), hash]);

      const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
      function base32Encode(data: Buffer): string {
        let bits = 0, value = 0, output = '';
        for (let i = 0; i < data.length; i++) {
          value = (value << 8) | data[i];
          bits += 8;
          while (bits >= 5) {
            output += base32Alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
          }
        }
        if (bits > 0) output += base32Alphabet[(value << (5 - bits)) & 31];
        return output;
      }

      const cid = 'b' + base32Encode(cidBytes);

      console.log(`\n${test.name}:`);
      console.log(`  CID: ${cid}`);
      console.log(`  Expected: ${file1Leaf!.Hash}`);
      console.log(`  Match: ${cid === file1Leaf!.Hash}`);
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
