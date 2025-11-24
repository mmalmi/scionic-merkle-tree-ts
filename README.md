# Scionic Merkle Tree - TypeScript Implementation

A TypeScript implementation of Scionic Merkle Trees, combining the strengths of Classic Merkle Trees and Merkle DAGs.

**Full feature parity with Go and Rust implementations!** ✨

## 🌐 Browser-First Design

This library is **primarily designed for browser environments** where TypeScript/JavaScript is the natural choice. It provides full Scionic Merkle Tree functionality in the browser with no native dependencies.

**For native/server applications**, consider using the [Rust implementation](https://github.com/HORNET-Storage/scionic-merkle-tree-rs) which offers:
- Superior performance (5-10x faster)
- Lower memory footprint
- Native system integration
- Compiled efficiency

Both implementations are fully compatible and can read each other's DAGs.

## Features

### Core Features
- **Hybrid Structure**: Combines Classic Merkle Trees and Merkle DAGs
- **Folder Support**: Store and verify entire directory structures
- **Chunked Parent Leaves**: Parent leaves use Classic Merkle Trees for efficiency
- **Compact Branches**: Logarithmic growth instead of linear
- **Cryptographic Verification**: CID-based hashing with SHA256
- **Serialization**: Supports both CBOR and JSON formats

### Advanced Features
- **Labels/LeafSync Protocol**: Numeric labels for range-based synchronization
- **Transmission Packets**: Incremental leaf-by-leaf DAG sync with Merkle proofs
- **Partial DAGs**: Extract subsets with verification paths
- **Edge Case Handling**: Robust support for empty files, unicode, special chars, etc.

### Interoperability
- ✅ **Go compatible**: Can read and verify Go-created DAGs
- ✅ **CBOR compatible**: Cross-language serialization
- ✅ **CIDv1 standard**: Uses CBOR codec (0x51) with SHA256

## Installation

### Node.js
```bash
npm install scionic-merkle-tree-ts
```

### Browser (ESM)
```html
<script type="module">
  import * as ScionicMerkleTree from './dist/browser/scionic-merkle-tree.es.js';
</script>
```

### Browser (UMD)
```html
<script src="./dist/browser/scionic-merkle-tree.umd.js"></script>
<script>
  const { createDagFromFile, verifyDag } = ScionicMerkleTree;
</script>
```

## Quick Start

### Node.js
```typescript
import { createDag, verifyDag, createDirectory } from 'scionic-merkle-tree-ts';

// Create a DAG from a directory
const dag = await createDag('./my-directory', true);

// Verify the DAG
await verifyDag(dag);

// Save to file
import { saveToFile, loadFromFile } from 'scionic-merkle-tree-ts';
saveToFile(dag, 'my-dag.cbor');

// Load from file
const loaded = loadFromFile('my-dag.cbor');

// Recreate the directory
createDirectory(loaded, './output-directory');
```

### Browser
```typescript
import { createDagFromFile, verifyDag, reconstructFile } from 'scionic-merkle-tree-ts/browser';

// Create DAG from file input
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const content = new Uint8Array(await file.arrayBuffer());

const dag = await createDagFromFile(file.name, content);

// Verify
await verifyDag(dag);

// Reconstruct
const reconstructed = reconstructFile(dag);
```

## API

### Creating DAGs

```typescript
import { createDag, verifyDag, createDirectory } from 'scionic-merkle-tree-ts';

// Create from file or directory
const dag = await createDag(inputPath, timestampRoot);

// Verify integrity
await verifyDag(dag);

// Recreate directory from DAG
createDirectory(dag, outputPath);
```

### Serialization

```typescript
import { toCBOR, fromCBOR, toJSON, fromJSON, saveToFile, loadFromFile } from 'scionic-merkle-tree-ts';

// CBOR (more compact)
const cbor = toCBOR(dag);
const dagFromCBOR = fromCBOR(cbor);

// JSON (human-readable)
const json = toJSON(dag);
const dagFromJSON = fromJSON(json);

// File operations
saveToFile(dag, 'my-dag.cbor');
const loaded = loadFromFile('my-dag.cbor');
```

### Labels/LeafSync Protocol

```typescript
import { calculateLabels, getHashesByLabelRange } from 'scionic-merkle-tree-ts';

// Calculate labels for all leaves
await calculateLabels(dag);

// Get leaves by label range (e.g., leaves 10-20)
const hashes = getHashesByLabelRange(dag, 10, 20);
```

### Transmission Protocol

```typescript
import { getLeafSequence, applyAndVerifyTransmissionPacket } from 'scionic-merkle-tree-ts';

// Sender: Generate transmission sequence
const packets = getLeafSequence(dag);

// Receiver: Apply packets incrementally
const receiverDag = { Root: dag.Root, Leafs: {} };
for (const packet of packets) {
  await applyAndVerifyTransmissionPacket(receiverDag, packet);
}
```

### Partial DAGs

```typescript
import { getPartial, isPartial } from 'scionic-merkle-tree-ts';

// Extract subset of files with verification paths
const fileHashes = ['bafi...', 'bafi...'];
const partial = getPartial(dag, fileHashes, true);

// Check if DAG is partial
if (isPartial(partial)) {
  console.log('This is a partial DAG');
}
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## License

MIT
