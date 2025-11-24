/**
 * Transmission Protocol for DAG Synchronization
 * Enables leaf-by-leaf transmission with Merkle proofs
 */

import { Dag, DagLeaf, TransmissionPacket, ScionicError, ClassicTreeBranch } from './types';
import { MerkleTree } from './merkleTree';
import { createHash } from 'crypto';

/**
 * Get transmission sequence in BFS order
 * Each packet contains a leaf, parent reference, and Merkle proofs
 */
export function getLeafSequence(dag: Dag): TransmissionPacket[] {
  const sequence: TransmissionPacket[] = [];
  const visited = new Set<string>();

  const rootLeaf = dag.Leafs[dag.Root];
  if (!rootLeaf) {
    return sequence;
  }

  // Create root packet
  const rootPacket: TransmissionPacket = {
    Leaf: cloneLeaf(rootLeaf),
    ParentHash: '',
    proofs: {},
  };
  sequence.push(rootPacket);
  visited.add(dag.Root);

  // BFS traversal to ensure parent comes before children
  const queue: string[] = [dag.Root];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLeaf = dag.Leafs[current];

    if (!currentLeaf.Links || currentLeaf.Links.length === 0) {
      continue;
    }

    // Sort links for deterministic order
    const sortedLinks = [...currentLeaf.Links].sort();

    // Build Merkle proof for children if parent has multiple links
    let childProofs: Record<string, ClassicTreeBranch> = {};
    if (currentLeaf.Links.length > 1 && currentLeaf.ClassicMerkleRoot) {
      childProofs = buildChildProofs(currentLeaf, dag);
    }

    // Process each child
    for (const childHash of sortedLinks) {
      if (visited.has(childHash)) {
        continue;
      }

      const childLeaf = dag.Leafs[childHash];
      if (!childLeaf) {
        continue;
      }

      const packet: TransmissionPacket = {
        Leaf: cloneLeaf(childLeaf),
        ParentHash: current,
        proofs: {},
      };

      // Add proof if available
      if (childProofs[childHash]) {
        packet.proofs![childHash] = childProofs[childHash];
      }

      sequence.push(packet);
      visited.add(childHash);
      queue.push(childHash);
    }
  }

  return sequence;
}

/**
 * Build Merkle proofs for all children of a parent leaf
 */
function buildChildProofs(parent: DagLeaf, dag: Dag): Record<string, ClassicTreeBranch> {
  const proofs: Record<string, ClassicTreeBranch> = {};

  if (!parent.Links || parent.Links.length <= 1 || !parent.ClassicMerkleRoot) {
    return proofs;
  }

  try {
    // Build Merkle tree from child hashes
    const hashedLeaves = parent.Links.map((link) => {
      const linkBytes = Buffer.from(link, 'utf-8');
      return new Uint8Array(createHash('sha256').update(linkBytes).digest());
    });

    const tree = new MerkleTree(hashedLeaves);

    // Generate proof for each child
    for (let i = 0; i < parent.Links.length; i++) {
      const childHash = parent.Links[i];
      const proof = tree.getProof(i);

      proofs[childHash] = {
        Leaf: childHash,
        Proof: proof,
      };
    }
  } catch (error) {
    // If we can't build proofs, return empty map
    console.error('Error building child proofs:', error);
  }

  return proofs;
}

/**
 * Clone a leaf (deep copy)
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
      clone.stored_proofs[k] = { ...v };
    }
  }

  return clone;
}

/**
 * Verify a transmission packet
 */
export async function verifyTransmissionPacket(dag: Dag, packet: TransmissionPacket): Promise<void> {
  // For now, do basic verification
  // Full verification would require implementing VerifyLeaf and VerifyRootLeaf

  if (packet.ParentHash === '') {
    // Root leaf - just verify it has required fields
    if (!packet.Leaf.Hash || !packet.Leaf.ItemName) {
      throw new ScionicError('Invalid root leaf in transmission packet');
    }
  } else {
    // Child leaf - verify parent exists and has the link
    const parent = dag.Leafs[packet.ParentHash];
    if (!parent) {
      throw new ScionicError(`Parent ${packet.ParentHash} not found in DAG`);
    }

    // If parent has multiple links, we need a Merkle proof
    if (parent.Links && parent.Links.length > 1) {
      if (!packet.proofs || !packet.proofs[packet.Leaf.Hash]) {
        throw new ScionicError(`Missing Merkle proof for leaf ${packet.Leaf.Hash}`);
      }

      if (parent.ClassicMerkleRoot && packet.proofs && packet.proofs[packet.Leaf.Hash]) {
        const proof = packet.proofs[packet.Leaf.Hash].Proof;
        const leafBytes = Buffer.from(packet.Leaf.Hash, 'utf-8');
        const leafHash = new Uint8Array(createHash('sha256').update(leafBytes).digest());

        const isValid = MerkleTree.verify(leafHash, proof, parent.ClassicMerkleRoot);
        if (!isValid) {
          throw new ScionicError(`Invalid Merkle proof for leaf ${packet.Leaf.Hash}`);
        }
      }
    }
  }
}

/**
 * Apply a transmission packet to the DAG
 */
export function applyTransmissionPacket(dag: Dag, packet: TransmissionPacket): void {
  // Add the leaf to the DAG
  dag.Leafs[packet.Leaf.Hash] = packet.Leaf;

  // Establish parent-child relationship
  if (packet.ParentHash !== '') {
    const parent = dag.Leafs[packet.ParentHash];
    if (parent) {
      // Ensure parent has the link
      if (!parent.Links) {
        parent.Links = [];
      }
      if (!parent.Links.includes(packet.Leaf.Hash)) {
        parent.Links.push(packet.Leaf.Hash);
        parent.CurrentLinkCount = parent.Links.length;
      }
    }
  }

  // Apply proofs to parent leaves
  if (packet.proofs) {
    for (const [leafHash, branch] of Object.entries(packet.proofs)) {
      // Find parent and store proof
      for (const leaf of Object.values(dag.Leafs)) {
        if (leaf.Links && leaf.Links.includes(leafHash)) {
          if (!leaf.stored_proofs) {
            leaf.stored_proofs = {};
          }
          leaf.stored_proofs[leafHash] = branch;
          break;
        }
      }
    }
  }
}

/**
 * Apply and verify a transmission packet
 */
export async function applyAndVerifyTransmissionPacket(
  dag: Dag,
  packet: TransmissionPacket
): Promise<void> {
  await verifyTransmissionPacket(dag, packet);
  applyTransmissionPacket(dag, packet);
}
