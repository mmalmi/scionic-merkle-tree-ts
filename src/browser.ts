/**
 * Browser-compatible API for Scionic Merkle Tree
 * Works with Uint8Array/Blob instead of filesystem
 */

export * from './types';
export { BrowserMerkleTree } from './browserMerkleTree';
export { createCID, parseCID, verifyCID, hashData } from './browserHash';
export { toCBOR, fromCBOR, toJSON, fromJSON } from './serialize';

import { BrowserDagLeafBuilder } from './browserLeaf';
import { Dag, DagLeaf, LeafType, DEFAULT_CHUNK_SIZE } from './types';
import { createCID, hashData } from './browserHash';
import { BrowserMerkleTree } from './browserMerkleTree';

/**
 * Create DAG from a single file (Uint8Array or Blob)
 */
export async function createDagFromFile(
  fileName: string,
  content: Uint8Array | Blob,
  options?: { timestampRoot?: boolean }
): Promise<Dag> {
  const data = content instanceof Blob ? new Uint8Array(await content.arrayBuffer()) : content;
  const leaves: Record<string, DagLeaf> = {};

  let rootLeaf: DagLeaf;

  // Check if file needs chunking
  if (data.length > DEFAULT_CHUNK_SIZE) {
    rootLeaf = await processLargeFile(fileName, data, leaves);
  } else {
    rootLeaf = await processSmallFile(fileName, data, leaves);
  }

  // Calculate statistics
  const leafCount = Object.keys(leaves).length;
  let contentSize = data.length;
  let childrenDagSize = 0;

  for (const [hash, leaf] of Object.entries(leaves)) {
    if (hash === rootLeaf.Hash) continue;

    const leafForSize = createLeafForSize(leaf);
    const cbor = await import('cbor');
    const leafCbor = cbor.encode(leafForSize);
    childrenDagSize += leafCbor.length;
  }

  delete leaves[rootLeaf.Hash];

  // Add timestamp if requested
  const additionalData = options?.timestampRoot
    ? { timestamp: new Date().toISOString() }
    : undefined;

  // Rebuild root with statistics
  const builder = new BrowserDagLeafBuilder(fileName).setType(LeafType.File);

  if (rootLeaf.Content) {
    builder.setData(rootLeaf.Content);
  }

  if (rootLeaf.Links) {
    for (const link of rootLeaf.Links) {
      builder.addLink(link);
    }
  }

  // Calculate root size
  const tempRoot = await builder.buildRootLeaf(additionalData, leafCount, contentSize, 0);
  const tempRootForSize = createTempRootForSize(tempRoot, additionalData);

  const cbor = await import('cbor');
  const rootCbor = cbor.encode(tempRootForSize);
  const dagSize = childrenDagSize + rootCbor.length;

  rootLeaf = await builder.buildRootLeaf(additionalData, leafCount, contentSize, dagSize);

  const dag: Dag = {
    Root: rootLeaf.Hash,
    Leafs: leaves,
  };

  dag.Leafs[rootLeaf.Hash] = rootLeaf;

  return dag;
}

/**
 * Process small file
 */
async function processSmallFile(
  fileName: string,
  content: Uint8Array,
  leaves: Record<string, DagLeaf>
): Promise<DagLeaf> {
  const builder = new BrowserDagLeafBuilder(fileName).setType(LeafType.File).setData(content);
  const leaf = await builder.buildLeaf();
  leaves[leaf.Hash] = leaf;
  return leaf;
}

/**
 * Process large file by chunking
 */
async function processLargeFile(
  fileName: string,
  content: Uint8Array,
  leaves: Record<string, DagLeaf>
): Promise<DagLeaf> {
  const chunkHashes: string[] = [];
  let offset = 0;
  let chunkIndex = 0;

  while (offset < content.length) {
    const chunkSize = Math.min(DEFAULT_CHUNK_SIZE, content.length - offset);
    const chunk = content.slice(offset, offset + chunkSize);

    const chunkName = `${fileName}.chunk.${chunkIndex}`;
    const chunkBuilder = new BrowserDagLeafBuilder(chunkName).setType(LeafType.Chunk).setData(chunk);

    const chunkLeaf = await chunkBuilder.buildLeaf();
    leaves[chunkLeaf.Hash] = chunkLeaf;
    chunkHashes.push(chunkLeaf.Hash);

    offset += chunkSize;
    chunkIndex++;
  }

  // Create parent file leaf
  const fileBuilder = new BrowserDagLeafBuilder(fileName).setType(LeafType.File);
  for (const hash of chunkHashes) {
    fileBuilder.addLink(hash);
  }

  const fileLeaf = await fileBuilder.buildLeaf();
  leaves[fileLeaf.Hash] = fileLeaf;

  return fileLeaf;
}

/**
 * Create leaf structure for size calculation
 */
function createLeafForSize(leaf: DagLeaf): any {
  const sortedLinks = leaf.Links ? [...leaf.Links].sort() : [];
  const sortedAdditionalData =
    leaf.AdditionalData && Object.keys(leaf.AdditionalData).length > 0
      ? Object.entries(leaf.AdditionalData)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .reduce((acc, [k, v]) => {
            acc[k] = v;
            return acc;
          }, {} as Record<string, string>)
      : {};

  return {
    Hash: leaf.Hash,
    ItemName: leaf.ItemName,
    Type: leaf.Type,
    ContentHash: leaf.ContentHash ? toBuffer(leaf.ContentHash) : null,
    Content: leaf.Content ? toBuffer(leaf.Content) : null,
    ClassicMerkleRoot: leaf.ClassicMerkleRoot ? toBuffer(leaf.ClassicMerkleRoot) : Buffer.alloc(0),
    CurrentLinkCount: leaf.CurrentLinkCount,
    LeafCount: leaf.LeafCount || 0,
    ContentSize: leaf.ContentSize || 0,
    DagSize: leaf.DagSize || 0,
    Links: sortedLinks,
    AdditionalData: sortedAdditionalData,
  };
}

/**
 * Create temp root structure for size calculation
 */
function createTempRootForSize(root: DagLeaf, additionalData?: Record<string, string>): any {
  const sortedAdditionalData =
    additionalData && Object.keys(additionalData).length > 0
      ? Object.entries(additionalData)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => ({ Key: k, Value: v }))
      : [];

  return {
    ItemName: root.ItemName,
    Type: root.Type,
    MerkleRoot: root.ClassicMerkleRoot ? toBuffer(root.ClassicMerkleRoot) : Buffer.alloc(0),
    CurrentLinkCount: root.CurrentLinkCount,
    LeafCount: root.LeafCount,
    ContentSize: root.ContentSize,
    DagSize: 0,
    ContentHash: root.ContentHash ? toBuffer(root.ContentHash) : null,
    AdditionalData: sortedAdditionalData,
  };
}

/**
 * Convert Uint8Array to Buffer (works in both Node and browser with polyfill)
 */
function toBuffer(data: Uint8Array): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  return Buffer.from(data);
}

/**
 * Verify DAG integrity
 */
export async function verifyDag(dag: Dag): Promise<void> {
  const rootLeaf = dag.Leafs[dag.Root];
  if (!rootLeaf) {
    throw new Error('Root leaf not found in DAG');
  }

  // Verify all leaves
  for (const [hash, leaf] of Object.entries(dag.Leafs)) {
    await verifyLeaf(hash, leaf, dag);
  }
}

/**
 * Verify a single leaf
 */
async function verifyLeaf(expectedHash: string, leaf: DagLeaf, dag: Dag): Promise<void> {
  // Verify linked children exist
  if (leaf.Links) {
    for (const linkHash of leaf.Links) {
      if (!dag.Leafs[linkHash]) {
        throw new Error(`Linked leaf ${linkHash} not found in DAG`);
      }
    }
  }

  // Verify content hash if present
  if (leaf.ContentHash && leaf.Content) {
    const computedHash = await hashData(leaf.Content);
    if (!arraysEqual(computedHash, leaf.ContentHash)) {
      throw new Error(`Content hash mismatch for leaf ${expectedHash}`);
    }
  }
}

/**
 * Compare two Uint8Arrays
 */
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Reconstruct file from DAG
 */
export function reconstructFile(dag: Dag): Uint8Array {
  const rootLeaf = dag.Leafs[dag.Root];
  if (!rootLeaf) {
    throw new Error('Root leaf not found');
  }

  if (rootLeaf.Type !== LeafType.File) {
    throw new Error('Root must be a file leaf');
  }

  // If file has chunks, reassemble
  if (rootLeaf.Links && rootLeaf.Links.length > 0) {
    const chunks: Uint8Array[] = [];
    for (const linkHash of rootLeaf.Links) {
      const chunkLeaf = dag.Leafs[linkHash];
      if (!chunkLeaf || !chunkLeaf.Content) {
        throw new Error(`Chunk ${linkHash} not found or has no content`);
      }
      chunks.push(chunkLeaf.Content);
    }

    // Concatenate chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } else if (rootLeaf.Content) {
    // Small file with direct content
    return rootLeaf.Content;
  } else {
    throw new Error('File has no content');
  }
}

// Version
export const VERSION = '0.1.0';
