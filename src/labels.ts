/**
 * Labels and LeafSync Protocol
 * Assigns numeric labels to leaves for range-based synchronization
 */

import { Dag, DagLeaf, ScionicError } from './types';

/**
 * Iterate through DAG in depth-first order
 */
export async function iterateDag(
  dag: Dag,
  processLeaf: (leaf: DagLeaf, parent: DagLeaf | null) => Promise<void> | void
): Promise<void> {
  const visited = new Set<string>();

  async function iterate(leafHash: string, parentHash: string | null): Promise<void> {
    if (visited.has(leafHash)) {
      return; // Already processed
    }
    visited.add(leafHash);

    const leaf = dag.Leafs[leafHash];
    if (!leaf) {
      throw new ScionicError(`Child is missing when iterating DAG (hash: ${leafHash})`);
    }

    const parent = parentHash ? dag.Leafs[parentHash] : null;

    await processLeaf(leaf, parent);

    // Process children
    if (leaf.Links && leaf.Links.length > 0) {
      for (const childHash of leaf.Links) {
        await iterate(childHash, leafHash);
      }
    }
  }

  await iterate(dag.Root, null);
}

/**
 * Calculate labels for all leaves in the DAG
 * Root is always label "0" and is not included in the Labels map
 * Returns the number of labels assigned
 */
export async function calculateLabels(dag: Dag): Promise<number> {
  if (!dag.Labels) {
    dag.Labels = {};
  } else {
    // Clear existing labels
    dag.Labels = {};
  }

  let labelCounter = 1;

  await iterateDag(dag, (leaf) => {
    // Skip the root (it's implicitly label "0")
    if (leaf.Hash === dag.Root) {
      return;
    }

    // Assign label to this leaf
    const label = labelCounter.toString();
    dag.Labels![label] = leaf.Hash;
    labelCounter++;
  });

  return labelCounter - 1; // Return count of labels assigned
}

/**
 * Clear all label assignments
 */
export function clearLabels(dag: Dag): void {
  if (dag.Labels) {
    dag.Labels = {};
  }
}

/**
 * Get hashes for a range of labels (inclusive)
 * For example, getHashesByLabelRange(dag, 20, 48) returns hashes for labels 20-48
 */
export function getHashesByLabelRange(
  dag: Dag,
  startLabel: number,
  endLabel: number
): string[] {
  if (!dag.Labels || Object.keys(dag.Labels).length === 0) {
    throw new ScionicError('Labels not calculated, call calculateLabels() first');
  }

  // Validate range
  if (startLabel < 1) {
    throw new ScionicError('Start label must be >= 1 (root is label 0 and not included)');
  }

  if (endLabel < startLabel) {
    throw new ScionicError(`End label (${endLabel}) must be >= start label (${startLabel})`);
  }

  const labelCount = Object.keys(dag.Labels).length;
  if (endLabel > labelCount) {
    throw new ScionicError(`End label (${endLabel}) exceeds available labels (${labelCount})`);
  }

  // Collect hashes in the specified range
  const hashes: string[] = [];
  for (let i = startLabel; i <= endLabel; i++) {
    const label = i.toString();
    const hash = dag.Labels[label];
    if (!hash) {
      throw new ScionicError(`Label "${label}" not found in labels map`);
    }
    hashes.push(hash);
  }

  return hashes;
}

/**
 * Get the label for a given leaf hash
 * Returns "0" if the hash is the root
 * Returns the numeric label as a string for other leaves
 */
export function getLabel(dag: Dag, hash: string): string {
  // Check if it's the root
  if (hash === dag.Root) {
    return '0';
  }

  if (!dag.Labels || Object.keys(dag.Labels).length === 0) {
    throw new ScionicError('Labels not calculated, call calculateLabels() first');
  }

  // Search for the hash in the labels map
  for (const [label, leafHash] of Object.entries(dag.Labels)) {
    if (leafHash === hash) {
      return label;
    }
  }

  throw new ScionicError(`Hash ${hash} not found in labels`);
}

/**
 * Get the hash for a given label
 * Label "0" returns the root hash
 */
export function getHashByLabel(dag: Dag, label: string): string {
  if (label === '0') {
    return dag.Root;
  }

  if (!dag.Labels || Object.keys(dag.Labels).length === 0) {
    throw new ScionicError('Labels not calculated, call calculateLabels() first');
  }

  const hash = dag.Labels[label];
  if (!hash) {
    throw new ScionicError(`Label "${label}" not found in labels map`);
  }

  return hash;
}
