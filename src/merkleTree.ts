/**
 * Classic Merkle Tree implementation
 * Used for parent leaves with many children
 */

import { createHash } from 'crypto';
import { MerkleProof } from './types';

/**
 * Hash a pair of nodes
 */
function hashPair(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return new Uint8Array(createHash('sha256').update(combined).digest());
}

/**
 * Classic Merkle Tree structure
 */
export class MerkleTree {
  private leaves: Uint8Array[];
  private layers: Uint8Array[][];

  constructor(leaves: Uint8Array[]) {
    if (leaves.length === 0) {
      throw new Error('Cannot create Merkle tree with no leaves');
    }
    this.leaves = leaves;
    this.layers = this.buildTree(leaves);
  }

  /**
   * Build the tree from leaves
   */
  private buildTree(leaves: Uint8Array[]): Uint8Array[][] {
    if (leaves.length === 0) {
      return [];
    }

    const layers: Uint8Array[][] = [leaves];
    let currentLayer = leaves;

    while (currentLayer.length > 1) {
      const nextLayer: Uint8Array[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          // Hash pair
          nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
        } else {
          // Odd node, promote it without hashing (matches Go/Rust implementation)
          nextLayer.push(currentLayer[i]);
        }
      }

      layers.push(nextLayer);
      currentLayer = nextLayer;
    }

    return layers;
  }

  /**
   * Get the root hash
   */
  getRoot(): Uint8Array {
    if (this.layers.length === 0) {
      throw new Error('Tree is empty');
    }
    return this.layers[this.layers.length - 1][0];
  }

  /**
   * Generate a Merkle proof for a leaf at the given index
   */
  getProof(leafIndex: number): MerkleProof {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error('Leaf index out of bounds');
    }

    const siblings: Uint8Array[] = [];
    let path = 0;
    let index = leafIndex;

    // Traverse from leaf to root
    for (let level = 0; level < this.layers.length - 1; level++) {
      const layer = this.layers[level];
      const isRightNode = index % 2 === 1;

      // Set bit in path if sibling is on right (we're on left)
      if (!isRightNode) {
        path |= 1 << level;
      }

      const siblingIndex = isRightNode ? index - 1 : index + 1;

      if (siblingIndex < layer.length) {
        siblings.push(layer[siblingIndex]);
      }
      // Skip if no sibling (odd promoted node)

      index = Math.floor(index / 2);
    }

    return {
      Siblings: siblings,
      Path: path,
    };
  }

  /**
   * Verify a Merkle proof
   */
  static verify(leaf: Uint8Array, proof: MerkleProof, root: Uint8Array): boolean {
    let current = leaf;

    for (let i = 0; i < proof.Siblings.length; i++) {
      const sibling = proof.Siblings[i];
      // Check bit in path - if set, sibling is on right (we're on left)
      const siblingOnRight = (proof.Path & (1 << i)) !== 0;

      if (siblingOnRight) {
        // Sibling on right, we're on left
        current = hashPair(current, sibling);
      } else {
        // Sibling on left, we're on right
        current = hashPair(sibling, current);
      }
    }

    // Compare the computed root with the expected root
    return current.length === root.length && current.every((val, idx) => val === root[idx]);
  }

  /**
   * Get the number of leaves
   */
  getLeafCount(): number {
    return this.leaves.length;
  }
}
