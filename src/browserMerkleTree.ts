/**
 * Browser-compatible Merkle Tree
 * Uses Web Crypto API instead of Node's crypto
 */

import { MerkleProof } from './types';
import { hashData } from './browserHash';

/**
 * Hash a pair of nodes (browser-compatible)
 */
async function hashPair(left: Uint8Array, right: Uint8Array): Promise<Uint8Array> {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return await hashData(combined);
}

/**
 * Browser-compatible Merkle Tree
 */
export class BrowserMerkleTree {
  private leaves: Uint8Array[];
  private layers: Uint8Array[][];

  constructor(leaves: Uint8Array[]) {
    if (leaves.length === 0) {
      throw new Error('Cannot create Merkle tree with no leaves');
    }
    this.leaves = leaves;
    this.layers = [];
  }

  /**
   * Build the tree asynchronously (required for Web Crypto)
   */
  async build(): Promise<void> {
    this.layers = await this.buildTree(this.leaves);
  }

  /**
   * Build the tree from leaves
   */
  private async buildTree(leaves: Uint8Array[]): Promise<Uint8Array[][]> {
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
          nextLayer.push(await hashPair(currentLayer[i], currentLayer[i + 1]));
        } else {
          // Odd node, promote it without hashing
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
      throw new Error('Tree not built yet - call build() first');
    }
    return this.layers[this.layers.length - 1][0];
  }

  /**
   * Generate a Merkle proof for a leaf at the given index
   */
  getProof(leafIndex: number): MerkleProof {
    if (this.layers.length === 0) {
      throw new Error('Tree not built yet - call build() first');
    }

    if (leafIndex < 0 || leafIndex >= this.leaves.length) {
      throw new Error('Leaf index out of bounds');
    }

    const siblings: Uint8Array[] = [];
    let path = 0;
    let index = leafIndex;
    let siblingCount = 0;

    for (let level = 0; level < this.layers.length - 1; level++) {
      const layer = this.layers[level];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;

      if (siblingIndex < layer.length) {
        siblings.push(layer[siblingIndex]);

        if (!isRightNode) {
          path |= 1 << siblingCount;
        }

        siblingCount++;
      }

      index = Math.floor(index / 2);
    }

    return {
      Siblings: siblings,
      Path: path,
    };
  }

  /**
   * Verify a Merkle proof (async for browser compatibility)
   */
  static async verify(leaf: Uint8Array, proof: MerkleProof, root: Uint8Array): Promise<boolean> {
    let current = leaf;

    for (let i = 0; i < proof.Siblings.length; i++) {
      const sibling = proof.Siblings[i];
      const siblingOnRight = (proof.Path & (1 << i)) !== 0;

      if (siblingOnRight) {
        current = await hashPair(current, sibling);
      } else {
        current = await hashPair(sibling, current);
      }
    }

    return current.length === root.length && current.every((val, idx) => val === root[idx]);
  }

  getLeafCount(): number {
    return this.leaves.length;
  }
}
