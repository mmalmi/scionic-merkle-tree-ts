# Scionic Merkle Tree - TypeScript Implementation

A TypeScript implementation of Scionic Merkle Trees, combining the strengths of Classic Merkle Trees and Merkle DAGs.

## Features

- **Hybrid Structure**: Combines Classic Merkle Trees and Merkle DAGs
- **Folder Support**: Store and verify entire directory structures
- **Chunked Parent Leaves**: Parent leaves use Classic Merkle Trees for efficiency
- **Compact Branches**: Logarithmic growth instead of linear
- **Cryptographic Verification**: CID-based hashing with SHA256
- **Serialization**: Supports both CBOR and JSON formats

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
import { createDag } from 'scionic-merkle-tree-ts';

// Create from file or directory
const dag = await createDag(inputPath, timestampRoot);
```

### Serialization

```typescript
import { toCBOR, fromCBOR, toJSON, fromJSON } from 'scionic-merkle-tree-ts';

// CBOR (more compact)
const cbor = toCBOR(dag);
const dagFromCBOR = fromCBOR(cbor);

// JSON (human-readable)
const json = toJSON(dag);
const dagFromJSON = fromJSON(json);
```

### Verification

```typescript
import { verifyDag } from 'scionic-merkle-tree-ts';

await verifyDag(dag);
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
