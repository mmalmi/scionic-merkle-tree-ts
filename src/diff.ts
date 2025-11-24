/**
 * DAG diff functionality
 *
 * Provides functions to compare two DAGs and identify added/removed leaves.
 */

import { Dag, DagLeaf, ScionicError } from './types';
import { getPartial } from './partial';

/**
 * Type of difference detected
 */
export enum DiffType {
  Added = 'added',
  Removed = 'removed',
}

/**
 * A single leaf difference
 */
export interface LeafDiff {
  type: DiffType;
  hash: string;
  leaf: DagLeaf;
}

/**
 * Summary of differences between two DAGs
 */
export interface DiffSummary {
  added: number;
  removed: number;
  total: number;
}

/**
 * Complete diff between two DAGs
 */
export interface DagDiff {
  diffs: Record<string, LeafDiff>;
  summary: DiffSummary;
}

/**
 * Get all added leaves from a diff
 */
export function getAddedLeaves(dagDiff: DagDiff): Record<string, DagLeaf> {
  const result: Record<string, DagLeaf> = {};
  for (const [hash, leafDiff] of Object.entries(dagDiff.diffs)) {
    if (leafDiff.type === DiffType.Added) {
      result[hash] = leafDiff.leaf;
    }
  }
  return result;
}

/**
 * Get all removed leaves from a diff
 */
export function getRemovedLeaves(dagDiff: DagDiff): Record<string, DagLeaf> {
  const result: Record<string, DagLeaf> = {};
  for (const [hash, leafDiff] of Object.entries(dagDiff.diffs)) {
    if (leafDiff.type === DiffType.Removed) {
      result[hash] = leafDiff.leaf;
    }
  }
  return result;
}

/**
 * Apply a diff to an old DAG to produce a new DAG
 */
export function applyDiffToDag(dagDiff: DagDiff, oldDag: Dag): Dag {
  // If no additions, return copy of old DAG
  if (dagDiff.summary.added === 0) {
    return {
      Root: oldDag.Root,
      Leafs: { ...oldDag.Leafs },
    };
  }

  // Build pool of all available leaves
  const leafPool: Record<string, DagLeaf> = { ...oldDag.Leafs };

  // Add new leaves from diff
  for (const [hash, leafDiff] of Object.entries(dagDiff.diffs)) {
    if (leafDiff.type === DiffType.Added) {
      leafPool[hash] = leafDiff.leaf;
    }
  }

  // Find all child hashes referenced by any leaf
  const childHashes = new Set<string>();
  for (const leaf of Object.values(leafPool)) {
    if (leaf.Links) {
      for (const link of leaf.Links) {
        childHashes.add(link);
      }
    }
  }

  // Find new root among added leaves (not referenced by any other leaf, has LeafCount)
  const addedLeaves = getAddedLeaves(dagDiff);
  let newRootHash: string | null = null;

  for (const [hash, leaf] of Object.entries(addedLeaves)) {
    if (!childHashes.has(hash)) {
      if (leaf.LeafCount !== undefined && leaf.LeafCount > 0) {
        newRootHash = hash;
        break;
      }
    }
  }

  if (!newRootHash) {
    throw new ScionicError('Cannot find new root among added leaves');
  }

  // Traverse from new root to collect referenced leaves
  const newLeaves: Record<string, DagLeaf> = {};
  const visited = new Set<string>();

  function traverse(hash: string): void {
    if (visited.has(hash)) return;
    visited.add(hash);

    const leaf = leafPool[hash];
    if (!leaf) {
      throw new ScionicError(`Missing leaf in pool: ${hash}`);
    }

    newLeaves[hash] = leaf;

    if (leaf.Links) {
      for (const childHash of leaf.Links) {
        traverse(childHash);
      }
    }
  }

  traverse(newRootHash);

  return {
    Root: newRootHash,
    Leafs: newLeaves,
  };
}

/**
 * Create a partial DAG containing only the added leaves with verification paths
 */
export function createPartialDagFromDiff(dagDiff: DagDiff, fullNewDag: Dag): Dag {
  const addedLeaves = getAddedLeaves(dagDiff);
  const addedHashes = Object.keys(addedLeaves);

  if (addedHashes.length === 0) {
    throw new ScionicError('No added leaves to create partial DAG');
  }

  return getPartial(fullNewDag, addedHashes, false);
}

/**
 * Compare two DAGs and return the differences
 */
export function diff(firstDag: Dag, secondDag: Dag): DagDiff {
  const diffs: Record<string, LeafDiff> = {};
  const summary: DiffSummary = { added: 0, removed: 0, total: 0 };

  const oldLeaves = new Set(Object.keys(firstDag.Leafs));
  const newLeaves = new Set(Object.keys(secondDag.Leafs));

  // Find added leaves (in second but not in first)
  for (const hash of newLeaves) {
    if (!oldLeaves.has(hash)) {
      diffs[hash] = {
        type: DiffType.Added,
        hash,
        leaf: secondDag.Leafs[hash],
      };
      summary.added++;
      summary.total++;
    }
  }

  // Find removed leaves (in first but not in second)
  for (const hash of oldLeaves) {
    if (!newLeaves.has(hash)) {
      diffs[hash] = {
        type: DiffType.Removed,
        hash,
        leaf: firstDag.Leafs[hash],
      };
      summary.removed++;
      summary.total++;
    }
  }

  return { diffs, summary };
}

/**
 * Compare old DAG with a set of new leaves (e.g., from partial DAG)
 * Identifies added leaves and removed leaves no longer referenced by new structure
 */
export function diffFromNewLeaves(
  originalDag: Dag,
  newLeaves: Record<string, DagLeaf>
): DagDiff {
  const diffs: Record<string, LeafDiff> = {};
  const summary: DiffSummary = { added: 0, removed: 0, total: 0 };

  const oldLeaveSet = new Set(Object.keys(originalDag.Leafs));

  // Find new root (leaf with LeafCount > 0)
  let newRoot: { hash: string; leaf: DagLeaf } | null = null;
  for (const [hash, leaf] of Object.entries(newLeaves)) {
    if (leaf.LeafCount !== undefined && leaf.LeafCount > 0) {
      newRoot = { hash, leaf };
      break;
    }
  }

  // Find added leaves
  for (const [hash, leaf] of Object.entries(newLeaves)) {
    if (!oldLeaveSet.has(hash)) {
      diffs[hash] = {
        type: DiffType.Added,
        hash,
        leaf,
      };
      summary.added++;
      summary.total++;
    }
  }

  // Find removed leaves - those not reachable from new root
  const reachable = new Set<string>();

  if (newRoot) {
    function traverseReachable(hash: string): void {
      if (reachable.has(hash)) return;
      reachable.add(hash);

      // Look in both new and old leaves
      const leaf = newLeaves[hash] || originalDag.Leafs[hash];
      if (leaf?.Links) {
        for (const childHash of leaf.Links) {
          traverseReachable(childHash);
        }
      }
    }

    traverseReachable(newRoot.hash);
  }

  // Any old leaf not reachable is removed
  for (const [hash, leaf] of Object.entries(originalDag.Leafs)) {
    if (!reachable.has(hash)) {
      diffs[hash] = {
        type: DiffType.Removed,
        hash,
        leaf,
      };
      summary.removed++;
      summary.total++;
    }
  }

  return { diffs, summary };
}
