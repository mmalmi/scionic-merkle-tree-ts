/**
 * DAG Leaf creation and manipulation
 */

import { createHash } from 'crypto';
import { MerkleTree } from './merkleTree';
import { DagLeaf, LeafType, ScionicError } from './types';
import { createCID } from './hash';

/**
 * Sort a map for deterministic serialization
 * Returns array of {Key, Value} objects matching Go's KeyValue struct
 */
function sortMapForVerification(
  map: Record<string, string> | undefined
): Array<{Key: string, Value: string}> {
  if (!map || Object.keys(map).length === 0) {
    return [];
  }
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ Key: k, Value: v }));
}

/**
 * Builder for creating DAG leaves
 */
export class DagLeafBuilder {
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
      // Hash each link first, then build tree from hashes
      const hashedLeaves = this.links.map((link) => {
        const linkBytes = Buffer.from(link, 'utf-8');
        return new Uint8Array(createHash('sha256').update(linkBytes).digest());
      });
      const tree = new MerkleTree(hashedLeaves);
      merkleRoot = tree.getRoot();
    } else if (this.links.length === 1) {
      // For single link, hash it directly
      const linkBytes = Buffer.from(this.links[0], 'utf-8');
      merkleRoot = new Uint8Array(createHash('sha256').update(linkBytes).digest());
    }

    // Compute content hash
    let contentHash: Uint8Array | undefined;
    if (this.data) {
      contentHash = new Uint8Array(createHash('sha256').update(this.data).digest());
    }

    // Create leaf data for hashing (must match Go/Rust structure exactly)
    const leafData = {
      ItemName: this.itemName,
      Type: this.leafType,
      MerkleRoot: merkleRoot || Buffer.alloc(0),  // Empty bytes, not empty array
      CurrentLinkCount: this.links.length,
      ContentHash: contentHash || null,  // Buffer or null, not array
      AdditionalData: sortMapForVerification(additionalData),
    };

    // Create CID from the leaf data
    const hash = await createCID(leafData);

    // Sort links (for directories only, preserve order for files)
    let sortedLinks = [...this.links];
    if (this.leafType === LeafType.Directory) {
      sortedLinks.sort();
    }

    // Build the final leaf
    const leaf: DagLeaf = {
      Hash: hash,
      ItemName: this.itemName,
      Type: this.leafType,
      CurrentLinkCount: this.links.length,
      Links: sortedLinks.length > 0 ? sortedLinks : undefined,
    };

    // Add optional fields
    if (contentHash) {
      leaf.ContentHash = contentHash;
    }
    if (this.data) {
      leaf.Content = this.data;
    }
    if (merkleRoot) {
      leaf.ClassicMerkleRoot = merkleRoot;
    }
    if (additionalData && Object.keys(additionalData).length > 0) {
      leaf.AdditionalData = additionalData;
    }

    return leaf;
  }

  /**
   * Build a root leaf with aggregate statistics
   */
  async buildRootLeaf(
    additionalData: Record<string, string> | undefined,
    leafCount: number,
    contentSize: number,
    dagSize: number
  ): Promise<DagLeaf> {
    // First build as regular leaf
    const leaf = await this.buildLeaf(additionalData);

    // Add root-specific fields
    leaf.LeafCount = leafCount;
    leaf.ContentSize = contentSize;
    leaf.DagSize = dagSize;

    // Recompute hash with root fields
  // Must match Go's final leafData structure exactly
  const leafData = {
    ItemName: leaf.ItemName,
    Type: leaf.Type,
    MerkleRoot: leaf.ClassicMerkleRoot ? Buffer.from(leaf.ClassicMerkleRoot) : Buffer.alloc(0),
    CurrentLinkCount: leaf.CurrentLinkCount,
    LeafCount: leafCount,
    ContentSize: contentSize,
    DagSize: dagSize,
    ContentHash: leaf.ContentHash ? Buffer.from(leaf.ContentHash) : null,
    AdditionalData: sortMapForVerification(additionalData),
  };

  leaf.Hash = await createCID(leafData);

    return leaf;
  }
}
