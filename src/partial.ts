/**
 * Partial DAG Support
 * Extract subset of leaves from a DAG with verification paths
 */

import { Dag, DagLeaf, ScionicError } from './types';

/**
 * Create a partial DAG containing only specified leaves and their verification paths
 * @param dag - Source DAG
 * @param leafHashes - Hashes of leaves to include
 * @param pruneLinks - If true, remove links to non-included leaves
 */
export function getPartial(dag: Dag, leafHashes: string[], pruneLinks: boolean): Dag {
  if (leafHashes.length === 0) {
    throw new ScionicError('No leaf hashes provided');
  }

  const partialDag: Dag = {
    Root: dag.Root,
    Leafs: {},
  };

  // Track all relevant hashes (requested leaves + verification path)
  const relevantHashes = new Set<string>();
  relevantHashes.add(dag.Root);

  // For each requested leaf, trace path to root
  for (const requestedHash of leafHashes) {
    const targetLeaf = dag.Leafs[requestedHash];
    if (!targetLeaf) {
      throw new ScionicError(`Leaf not found: ${requestedHash}`);
    }

    relevantHashes.add(requestedHash);

    // Add all ancestors in the path to root
    findPathToRoot(dag, requestedHash, relevantHashes);
  }

  // Copy relevant leaves to partial DAG
  for (const hash of relevantHashes) {
    const leaf = dag.Leafs[hash];
    if (leaf) {
      if (pruneLinks) {
        // Clone and prune links
        const cloned = cloneLeaf(leaf);
        if (cloned.Links) {
          cloned.Links = cloned.Links.filter((link) => relevantHashes.has(link));
          cloned.CurrentLinkCount = cloned.Links.length;
        }
        partialDag.Leafs[hash] = cloned;
      } else {
        // Keep all links
        partialDag.Leafs[hash] = cloneLeaf(leaf);
      }
    }
  }

  return partialDag;
}

/**
 * Find path from a leaf to root, adding all ancestors to the set
 */
function findPathToRoot(dag: Dag, leafHash: string, visited: Set<string>): void {
  // Simple BFS from root to find parent relationships
  // Since we don't store parent pointers, we need to search
  const queue: string[] = [dag.Root];
  const parents = new Map<string, string>();
  const queued = new Set<string>();
  queued.add(dag.Root);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const leaf = dag.Leafs[current];

    if (leaf.Links) {
      for (const childHash of leaf.Links) {
        if (!queued.has(childHash)) {
          parents.set(childHash, current);
          queue.push(childHash);
          queued.add(childHash);
        }
      }
    }
  }

  // Trace path from leaf to root
  let current: string | undefined = leafHash;
  while (current) {
    visited.add(current);
    current = parents.get(current);
  }
}

/**
 * Clone a leaf
 */
function cloneLeaf(leaf: DagLeaf): DagLeaf {
  const clone: DagLeaf = {
    Hash: leaf.Hash,
    ItemName: leaf.ItemName,
    Type: leaf.Type,
    CurrentLinkCount: leaf.CurrentLinkCount,
  };

  if (leaf.ContentHash) clone.ContentHash = new Uint8Array(leaf.ContentHash);
  if (leaf.Content) clone.Content = new Uint8Array(leaf.Content);
  if (leaf.ClassicMerkleRoot) clone.ClassicMerkleRoot = new Uint8Array(leaf.ClassicMerkleRoot);
  if (leaf.LeafCount !== undefined) clone.LeafCount = leaf.LeafCount;
  if (leaf.ContentSize !== undefined) clone.ContentSize = leaf.ContentSize;
  if (leaf.DagSize !== undefined) clone.DagSize = leaf.DagSize;
  if (leaf.Links) clone.Links = [...leaf.Links];
  if (leaf.ParentHash) clone.ParentHash = leaf.ParentHash;
  if (leaf.AdditionalData) clone.AdditionalData = { ...leaf.AdditionalData };
  if (leaf.stored_proofs) {
    clone.stored_proofs = {};
    for (const [k, v] of Object.entries(leaf.stored_proofs)) {
      clone.stored_proofs[k] = {
        Leaf: v.Leaf,
        Proof: {
          Siblings: v.Proof.Siblings.map(s => new Uint8Array(s)),
          Path: v.Proof.Path,
        },
      };
    }
  }

  return clone;
}

/**
 * Check if DAG is partial (has pruned links)
 */
export function isPartial(dag: Dag): boolean {
  // A partial DAG has leaves that reference non-existent children
  for (const leaf of Object.values(dag.Leafs)) {
    if (leaf.Links) {
      for (const linkHash of leaf.Links) {
        if (!dag.Leafs[linkHash]) {
          return true; // Found a link to a missing leaf
        }
      }
    }
  }
  return false;
}
