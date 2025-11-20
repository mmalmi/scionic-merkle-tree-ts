/**
 * Browser-compatible DAG Leaf creation
 */

import { DagLeaf, LeafType, ScionicError } from './types';
import { createCID, hashData } from './browserHash';
import { BrowserMerkleTree } from './browserMerkleTree';

/**
 * Sort a map for deterministic serialization
 */
function sortMapForVerification(
  map: Record<string, string> | undefined
): Array<{ Key: string; Value: string }> {
  if (!map || Object.keys(map).length === 0) {
    return [];
  }
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ Key: k, Value: v }));
}

/**
 * Builder for creating DAG leaves (browser version)
 */
export class BrowserDagLeafBuilder {
  private itemName: string;
  private leafType?: LeafType;
  private data?: Uint8Array;
  private links: string[] = [];

  constructor(itemName: string) {
    this.itemName = itemName;
  }

  setType(leafType: LeafType): this {
    this.leafType = leafType;
    return this;
  }

  setData(data: Uint8Array): this {
    this.data = data;
    return this;
  }

  addLink(hash: string): this {
    this.links.push(hash);
    return this;
  }

  /**
   * Build a regular (non-root) leaf
   */
  async buildLeaf(additionalData?: Record<string, string>): Promise<DagLeaf> {
    if (!this.leafType) {
      throw new ScionicError('Leaf must have a type');
    }

    // Build merkle root for links
    let merkleRoot: Uint8Array | undefined;
    if (this.links.length > 1) {
      const hashedLeaves: Uint8Array[] = [];
      for (const link of this.links) {
        const linkBytes = new TextEncoder().encode(link);
        hashedLeaves.push(await hashData(linkBytes));
      }
      const tree = new BrowserMerkleTree(hashedLeaves);
      await tree.build();
      merkleRoot = tree.getRoot();
    } else if (this.links.length === 1) {
      const linkBytes = new TextEncoder().encode(this.links[0]);
      merkleRoot = await hashData(linkBytes);
    }

    // Compute content hash
    let contentHash: Uint8Array | undefined;
    if (this.data) {
      contentHash = await hashData(this.data);
    }

    // Create leaf data for hashing
    const leafData = {
      ItemName: this.itemName,
      Type: this.leafType,
      MerkleRoot: merkleRoot ? toBuffer(merkleRoot) : Buffer.alloc(0),
      CurrentLinkCount: this.links.length,
      ContentHash: contentHash ? toBuffer(contentHash) : null,
      AdditionalData: sortMapForVerification(additionalData),
    };

    // Create CID
    const hash = await createCID(leafData);

    // Sort links for directories
    let sortedLinks = [...this.links];
    if (this.leafType === LeafType.Directory) {
      sortedLinks.sort();
    }

    // Build final leaf
    const leaf: DagLeaf = {
      Hash: hash,
      ItemName: this.itemName,
      Type: this.leafType,
      CurrentLinkCount: this.links.length,
      Links: sortedLinks.length > 0 ? sortedLinks : undefined,
    };

    if (contentHash) leaf.ContentHash = contentHash;
    if (this.data) leaf.Content = this.data;
    if (merkleRoot) leaf.ClassicMerkleRoot = merkleRoot;
    if (additionalData && Object.keys(additionalData).length > 0) {
      leaf.AdditionalData = additionalData;
    }

    return leaf;
  }

  /**
   * Build a root leaf with statistics
   */
  async buildRootLeaf(
    additionalData: Record<string, string> | undefined,
    leafCount: number,
    contentSize: number,
    dagSize: number
  ): Promise<DagLeaf> {
    const leaf = await this.buildLeaf(additionalData);

    leaf.LeafCount = leafCount;
    leaf.ContentSize = contentSize;
    leaf.DagSize = dagSize;

    // Recompute hash with root fields
    const leafData = {
      ItemName: leaf.ItemName,
      Type: leaf.Type,
      MerkleRoot: leaf.ClassicMerkleRoot ? toBuffer(leaf.ClassicMerkleRoot) : Buffer.alloc(0),
      CurrentLinkCount: leaf.CurrentLinkCount,
      LeafCount: leafCount,
      ContentSize: contentSize,
      DagSize: dagSize,
      ContentHash: leaf.ContentHash ? toBuffer(leaf.ContentHash) : null,
      AdditionalData: sortMapForVerification(additionalData),
    };

    leaf.Hash = await createCID(leafData);

    return leaf;
  }
}

/**
 * Convert Uint8Array to Buffer
 */
function toBuffer(data: Uint8Array): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  return Buffer.from(data);
}
