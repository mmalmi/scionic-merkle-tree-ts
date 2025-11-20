# Scionic Merkle Tree - TypeScript Implementation

A TypeScript implementation of Scionic Merkle Trees, combining the strengths of Classic Merkle Trees and Merkle DAGs.

**Full feature parity with Go and Rust implementations!** ✨

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

```bash
npm install scionic-merkle-tree-ts
```

## Quick Start

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
