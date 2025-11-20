#!/usr/bin/env ts-node
/**
 * Test helper for Go interoperability testing
 * Similar to Rust's create_for_go example
 */

import { createDag } from '../src/dag';
import { saveToFile, loadFromFile } from '../src/serialize';
import { verifyDag } from '../src/dag';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: ts-node testHelper.ts <command> [args...]');
    console.log('Commands:');
    console.log('  create <input_path> <output_cbor>  - Create DAG and save to CBOR');
    console.log('  verify <cbor_path>                  - Load and verify DAG from CBOR');
    console.log('  info <input_path>                   - Print DAG info');
    process.exit(1);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'create': {
        if (args.length < 3) {
          console.error('Usage: testHelper.ts create <input_path> <output_cbor>');
          process.exit(1);
        }

        const inputPath = args[1];
        const outputCbor = args[2];

        // Create DAG
        const dag = await createDag(inputPath, false);

        // Verify
        await verifyDag(dag);

        // Save to CBOR
        saveToFile(dag, outputCbor);

        console.log(`Success! Root: ${dag.Root}, Leaves: ${Object.keys(dag.Leafs).length}`);
        break;
      }

      case 'verify': {
        if (args.length < 2) {
          console.error('Usage: testHelper.ts verify <cbor_path>');
          process.exit(1);
        }

        const cborPath = args[1];

        // Load CBOR
        const dag = loadFromFile(cborPath);

        // Verify
        await verifyDag(dag);

        console.log(`Success! Root: ${dag.Root}, Leaves: ${Object.keys(dag.Leafs).length}`);
        break;
      }

      case 'info': {
        if (args.length < 2) {
          console.error('Usage: testHelper.ts info <input_path>');
          process.exit(1);
        }

        const inputPath = args[1];

        // Create DAG
        const dag = await createDag(inputPath, false);

        // Print info
        console.log(`Root: ${dag.Root}`);
        console.log(`Leaves: ${Object.keys(dag.Leafs).length}`);
        console.log('\nLeaf details:');
        for (const [hash, leaf] of Object.entries(dag.Leafs).slice(0, 10)) {
          console.log(`  ${hash.substring(0, 20)}: type=${leaf.Type} name=${leaf.ItemName} links=${leaf.CurrentLinkCount}`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}

main();
