/**
 * Debug exact CBOR encoding to match Go
 */

import { createDag } from '../src/dag';
import * as fs from 'fs';

const BITCOIN_PDF = '/workspace/scionic-merkle-tree-ts/bitcoin.pdf';

describe('Exact CBOR Matching', () => {
  test('debug leaf data encoding', async () => {
    const dag = await createDag(BITCOIN_PDF, false);
    const root = dag.Leafs[dag.Root];

    console.log('Root leaf properties:');
    console.log(`  ItemName: "${root.ItemName}"`);
    console.log(`  Type: "${root.Type}"`);
    console.log(`  MerkleRoot: ${root.ClassicMerkleRoot ? Buffer.from(root.ClassicMerkleRoot).toString('hex') : 'none'}`);
    console.log(`  CurrentLinkCount: ${root.CurrentLinkCount}`);
    console.log(`  LeafCount: ${root.LeafCount}`);
    console.log(`  ContentSize: ${root.ContentSize}`);
    console.log(`  DagSize: ${root.DagSize}`);
    console.log(`  ContentHash: ${root.ContentHash ? Buffer.from(root.ContentHash).toString('hex') : 'none'}`);
    console.log(`  AdditionalData: ${JSON.stringify(root.AdditionalData)}`);

    // Manually create the exact structure for CID calculation
    const cbor = require('cbor');

    const leafDataForHash = {
      ItemName: root.ItemName,
      Type: root.Type,
      MerkleRoot: root.ClassicMerkleRoot || Buffer.alloc(0),
      CurrentLinkCount: root.CurrentLinkCount,
      LeafCount: root.LeafCount,
      ContentSize: root.ContentSize,
      DagSize: root.DagSize,
      ContentHash: root.ContentHash || null,
      AdditionalData: [],
    };

    const encoded = cbor.encode(leafDataForHash);
    console.log(`\nCBOR encoded for CID:`);
    console.log(`  Size: ${encoded.length} bytes`);
    console.log(`  Hex: ${encoded.toString('hex')}`);

    // Calculate hash of this CBOR
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(encoded).digest();
    console.log(`  SHA256: ${hash.toString('hex')}`);

    // Build CID manually
    const cidBytes = Buffer.concat([
      Buffer.from([0x01]), // version
      Buffer.from([0x51]), // codec
      Buffer.from([0x12]), // hash function (SHA2-256)
      Buffer.from([0x20]), // hash length (32)
      hash
    ]);

    // Base32 encode
    const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
    function base32Encode(data: Buffer): string {
      let bits = 0;
      let value = 0;
      let output = '';

      for (let i = 0; i < data.length; i++) {
        value = (value << 8) | data[i];
        bits += 8;

        while (bits >= 5) {
          output += base32Alphabet[(value >>> (bits - 5)) & 31];
          bits -= 5;
        }
      }

      if (bits > 0) {
        output += base32Alphabet[(value << (5 - bits)) & 31];
      }

      return output;
    }

    const cid = 'b' + base32Encode(cidBytes);
    console.log(`  Calculated CID: ${cid}`);
    console.log(`  Stored CID:     ${root.Hash}`);
    console.log(`  Match: ${cid === root.Hash}`);
  });
});
