/**
 * Serialization and deserialization for DAGs
 */

import * as cbor from 'cbor';
import { Dag, DagLeaf, ScionicError } from './types';
import * as fs from 'fs';

/**
 * Serialize DAG to CBOR
 */
export function toCBOR(dag: Dag): Uint8Array {
  try {
    return cbor.encode(dag);
  } catch (error) {
    throw new ScionicError(`CBOR serialization failed: ${error}`);
  }
}

/**
 * Deserialize DAG from CBOR
 */
export function fromCBOR(data: Uint8Array): Dag {
  try {
    const decoded = cbor.decode(Buffer.from(data));
    return normalizeDag(decoded);
  } catch (error) {
    throw new ScionicError(`CBOR deserialization failed: ${error}`);
  }
}

/**
 * Serialize DAG to JSON
 */
export function toJSON(dag: Dag): string {
  try {
    return JSON.stringify(dag, (key, value) => {
      // Convert Uint8Array to array for JSON
      if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
        return Array.from(value);
      }
      return value;
    }, 2);
  } catch (error) {
    throw new ScionicError(`JSON serialization failed: ${error}`);
  }
}

/**
 * Deserialize DAG from JSON
 */
export function fromJSON(json: string): Dag {
  try {
    const parsed = JSON.parse(json);
    return normalizeDag(parsed);
  } catch (error) {
    throw new ScionicError(`JSON deserialization failed: ${error}`);
  }
}

/**
 * Normalize DAG structure after deserialization
 * Ensures all byte arrays are Uint8Array
 */
function normalizeDag(data: any): Dag {
  if (!data.Root || !data.Leafs) {
    throw new ScionicError('Invalid DAG structure: missing Root or Leafs');
  }

  const dag: Dag = {
    Root: data.Root,
    Leafs: {},
    Labels: data.Labels,
  };

  // Normalize each leaf
  for (const [hash, leaf] of Object.entries(data.Leafs)) {
    dag.Leafs[hash] = normalizeLeaf(leaf as any);
  }

  return dag;
}

/**
 * Normalize a single leaf
 */
function normalizeLeaf(leaf: any): DagLeaf {
  const normalized: DagLeaf = {
    Hash: leaf.Hash,
    ItemName: leaf.ItemName,
    Type: leaf.Type,
    CurrentLinkCount: leaf.CurrentLinkCount,
  };

  // Normalize byte arrays
  if (leaf.ContentHash) {
    normalized.ContentHash = toUint8Array(leaf.ContentHash);
  }
  if (leaf.Content) {
    normalized.Content = toUint8Array(leaf.Content);
  }
  if (leaf.ClassicMerkleRoot) {
    normalized.ClassicMerkleRoot = toUint8Array(leaf.ClassicMerkleRoot);
  }

  // Copy other optional fields
  if (leaf.LeafCount !== undefined) normalized.LeafCount = leaf.LeafCount;
  if (leaf.ContentSize !== undefined) normalized.ContentSize = leaf.ContentSize;
  if (leaf.DagSize !== undefined) normalized.DagSize = leaf.DagSize;
  if (leaf.Links) normalized.Links = leaf.Links;
  if (leaf.ParentHash) normalized.ParentHash = leaf.ParentHash;
  if (leaf.AdditionalData) normalized.AdditionalData = leaf.AdditionalData;
  if (leaf.stored_proofs) normalized.stored_proofs = leaf.stored_proofs;

  return normalized;
}

/**
 * Convert various byte representations to Uint8Array
 */
function toUint8Array(data: any): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  if (data && typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
    // Handle JSON-parsed Buffer objects
    return new Uint8Array(data.data);
  }
  throw new ScionicError(`Cannot convert to Uint8Array: ${typeof data}`);
}

/**
 * Save DAG to file
 */
export function saveToFile(dag: Dag, filePath: string): void {
  const cbor = toCBOR(dag);
  fs.writeFileSync(filePath, cbor);
}

/**
 * Load DAG from file
 */
export function loadFromFile(filePath: string): Dag {
  const data = fs.readFileSync(filePath);
  return fromCBOR(data);
}
