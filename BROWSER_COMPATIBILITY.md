# Browser Compatibility

## ✅ Full Browser Support Achieved!

The TypeScript implementation now works in **both Node.js and browser environments**.

## Build Outputs

### Node.js (CommonJS)
- **Location**: `dist/index.js`
- **Format**: CommonJS with TypeScript declarations
- **Usage**: `require('scionic-merkle-tree-ts')` or `import` in Node.js

### Browser (ES Modules)
- **Location**: `dist/browser/scionic-merkle-tree.es.js`
- **Format**: ES Module
- **Size**: 117.6 KB (28 KB gzipped)
- **Usage**: `<script type="module">`

### Browser (UMD)
- **Location**: `dist/browser/scionic-merkle-tree.umd.js`
- **Format**: Universal Module Definition
- **Size**: 52.8 KB (16.7 KB gzipped)
- **Usage**: `<script src="...">`

## Browser API

### Key Differences from Node.js API

| Feature | Node.js | Browser |
|---------|---------|---------|
| **Input** | File paths | Uint8Array or Blob |
| **Output** | File system | Uint8Array |
| **Hashing** | Node crypto | Web Crypto API |
| **Directory support** | ✓ Full | ✗ Single files only |
| **Serialization** | ✓ CBOR + JSON | ✓ CBOR + JSON |

### Browser-Specific Functions

```typescript
// Create DAG from file
createDagFromFile(fileName: string, content: Uint8Array | Blob): Promise<Dag>

// Verify DAG
verifyDag(dag: Dag): Promise<void>

// Reconstruct file
reconstructFile(dag: Dag): Uint8Array

// Merkle tree (async for Web Crypto)
BrowserMerkleTree.verify(leaf, proof, root): Promise<boolean>

// Hashing (async for Web Crypto)
hashData(data: Uint8Array): Promise<Uint8Array>
createCID(data: any): Promise<string>
```

## Usage Examples

### File Upload and Hash
```html
<input type="file" id="fileInput">
<script type="module">
  import { createDagFromFile, verifyDag } from './dist/browser/scionic-merkle-tree.es.js';

  document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const content = new Uint8Array(await file.arrayBuffer());

    const dag = await createDagFromFile(file.name, content);
    console.log('Root CID:', dag.Root);

    await verifyDag(dag);
    console.log('✓ Verification passed');
  });
</script>
```

### Large File Chunking
```typescript
import { createDagFromFile, reconstructFile } from './dist/browser/scionic-merkle-tree.es.js';

// Process large file
const largeFile = new Uint8Array(5 * 1024 * 1024); // 5MB
const dag = await createDagFromFile('large.bin', largeFile);

// DAG automatically chunks files > 2MB
const chunks = Object.values(dag.Leafs).filter(leaf => leaf.Type === 'chunk');
console.log(`Created ${chunks.length} chunks`);

// Reconstruct
const reconstructed = reconstructFile(dag);
console.log('Reconstructed size:', reconstructed.length);
```

### Merkle Proofs in Browser
```typescript
import { BrowserMerkleTree, hashData } from './dist/browser/scionic-merkle-tree.es.js';

// Create tree
const leaves = [
  await hashData(new TextEncoder().encode('data1')),
  await hashData(new TextEncoder().encode('data2')),
  await hashData(new TextEncoder().encode('data3')),
];

const tree = new BrowserMerkleTree(leaves);
await tree.build();

// Generate and verify proof
const proof = tree.getProof(0);
const root = tree.getRoot();
const isValid = await BrowserMerkleTree.verify(leaves[0], proof, root);
console.log('Proof valid:', isValid);
```

## Test Results

### Vitest (Browser Environment)
```
Test Files: 1 passed (1)
Tests:      8 passed (8)
```

**All browser tests passing!** ✅

### Test Coverage
- ✓ Small file DAG creation
- ✓ Large file chunking
- ✓ File reconstruction
- ✓ Empty file handling
- ✓ Merkle tree operations
- ✓ CID generation
- ✓ Deterministic hashing
- ✓ Blob input support

### Combined Test Results
```
Node.js:  91 tests passing (Jest)
Browser:   8 tests passing (Vitest)
Total:    99 tests passing
```

## Technical Implementation

### Web Crypto API
Replaces Node.js `crypto` module with browser-standard Web Crypto API:
```typescript
// Node.js
import { createHash } from 'crypto';
const hash = createHash('sha256').update(data).digest();

// Browser
const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
const hash = new Uint8Array(hashBuffer);
```

### Async Hashing
Browser crypto is async, so all hashing operations return Promises:
```typescript
// Node.js (sync)
const hash = hashData(content);

// Browser (async)
const hash = await hashData(content);
```

### CBOR Support
Uses same `cbor` package with Vite bundling for browser compatibility.

### Buffer Polyfill
Browser bundle includes Buffer polyfill from `cbor` package dependencies.

## Limitations

### Browser-Specific
- **No filesystem access**: Can only process in-memory data
- **No directory traversal**: Single file processing only
- **Memory constraints**: Large files limited by browser memory
- **Async hashing**: All operations async due to Web Crypto API

### Workarounds
- Use File API for file uploads
- Use IndexedDB for storage
- Process directories as ZIP files
- Use Web Workers for large files

## Build Process

```bash
# Build Node.js version
npm run build:node

# Build browser version
npm run build:browser

# Build both
npm run build

# Test both
npm run test:all
```

## Browser Compatibility

### Supported Browsers
- ✅ Chrome/Edge 60+
- ✅ Firefox 57+
- ✅ Safari 11.1+
- ✅ Opera 47+

### Requirements
- **Web Crypto API** (all modern browsers)
- **TextEncoder/TextDecoder** (all modern browsers)
- **Uint8Array** (all modern browsers)
- **ES6 Modules** (or UMD fallback)

## Production Use

The browser build is **production-ready** for:
- Client-side file integrity verification
- Content-addressable storage in browsers
- Merkle proof generation/verification
- IPFS-compatible CID generation
- P2P data exchange protocols

**Bundle sizes are optimized** and suitable for production deployment.
