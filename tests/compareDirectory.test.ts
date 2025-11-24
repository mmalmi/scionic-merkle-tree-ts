/**
 * Compare TypeScript vs Go for directory DAG
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag } from '../src/dag';
import { fromCBOR } from '../src/serialize';
import { runGoCommand } from './testHelpers';

describe('Directory DAG Comparison', () => {
  test('compare TS and Go directory DAGs', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dir-compare-'));

    const inputDir = path.join(tempDir, 'input');
    fs.mkdirSync(inputDir);

    fs.writeFileSync(path.join(inputDir, 'file1.txt'), 'content from test 1');
    fs.writeFileSync(path.join(inputDir, 'file2.txt'), 'content from test 2');

    // TypeScript DAG
    const tsDag = await createDag(inputDir, false);

    console.log('\n=== TypeScript DAG ===');
    console.log(`Root: ${tsDag.Root}`);

    for (const [hash, leaf] of Object.entries(tsDag.Leafs)) {
      console.log(`\nLeaf: ${hash}`);
      console.log(`  Name: ${leaf.ItemName}`);
      console.log(`  Type: ${leaf.Type}`);
      console.log(`  Links: ${leaf.CurrentLinkCount}`);
      if (leaf.ContentHash) {
        console.log(`  ContentHash: ${Buffer.from(leaf.ContentHash).toString('hex')}`);
      }
    }

    // Go DAG
    const goCborPath = path.join(tempDir, 'go.cbor');
    runGoCommand(`go run cmd/test_helper.go create "${inputDir}" "${goCborPath}"`);

    const goDag = fromCBOR(fs.readFileSync(goCborPath));

    console.log('\n=== Go DAG ===');
    console.log(`Root: ${goDag.Root}`);

    for (const [hash, leaf] of Object.entries(goDag.Leafs)) {
      console.log(`\nLeaf: ${hash}`);
      console.log(`  Name: ${leaf.ItemName}`);
      console.log(`  Type: ${leaf.Type}`);
      console.log(`  Links: ${leaf.CurrentLinkCount}`);
      if (leaf.ContentHash) {
        console.log(`  ContentHash: ${Buffer.from(leaf.ContentHash).toString('hex')}`);
      }
    }

    console.log('\n=== Comparison ===');

    // Find corresponding leaves by ItemName
    const tsLeavesByName = new Map();
    const goLeavesByName = new Map();

    for (const leaf of Object.values(tsDag.Leafs)) {
      tsLeavesByName.set(leaf.ItemName, leaf);
    }

    for (const leaf of Object.values(goDag.Leafs)) {
      goLeavesByName.set(leaf.ItemName, leaf);
    }

    for (const name of tsLeavesByName.keys()) {
      const tsLeaf = tsLeavesByName.get(name);
      const goLeaf = goLeavesByName.get(name);

      if (goLeaf) {
        const hashMatch = tsLeaf.Hash === goLeaf.Hash;
        console.log(`\n${name}:`);
        console.log(`  TS hash: ${tsLeaf.Hash}`);
        console.log(`  Go hash: ${goLeaf.Hash}`);
        console.log(`  Match: ${hashMatch ? '✓' : '✗'}`);
      }
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
