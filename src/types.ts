/**
 * Scionic Merkle Tree - TypeScript Implementation
 * Types and interfaces
 */

export const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Type of leaf in the DAG
 */
export enum LeafType {
  File = 'file',
  Chunk = 'chunk',
  Directory = 'directory',
}

/**
 * Merkle proof structure
 */
export interface MerkleProof {
  /** Sibling hashes along the path to root */
  Siblings: Uint8Array[];
  /** Path bitmap (uint32) indicating whether sibling is on left (0) or right (1) */
  Path: number;
}

/**
 * Classic Merkle tree branch/proof for a specific leaf
 */
export interface ClassicTreeBranch {
  /** The leaf hash this proof is for */
  Leaf: string;
  /** The Merkle proof */
  Proof: MerkleProof;
}

/**
 * A leaf in the Scionic Merkle DAG
 */
export interface DagLeaf {
  /** CID hash of this leaf */
  Hash: string;
  /** Name/path of the item */
  ItemName: string;
  /** Type of leaf */
  Type: LeafType;
  /** Hash of the content (SHA256) */
  ContentHash?: Uint8Array;
  /** Actual content bytes */
  Content?: Uint8Array;
  /** Classic Merkle tree root for children */
  ClassicMerkleRoot?: Uint8Array;
  /** Number of links this leaf has */
  CurrentLinkCount: number;
  /** Total number of leaves in DAG (root only) */
  LeafCount?: number;
  /** Total content size (root only) */
  ContentSize?: number;
  /** Total DAG size (root only) */
  DagSize?: number;
  /** Links to child leaves (hashes) */
  Links?: string[];
  /** Parent hash (for traversal, not verified) */
  ParentHash?: string;
  /** Additional metadata */
  AdditionalData?: Record<string, string>;
  /** Merkle proofs for partial DAG verification */
  stored_proofs?: Record<string, ClassicTreeBranch>;
}

/**
 * The main Scionic Merkle DAG structure
 */
export interface Dag {
  /** Root leaf hash */
  Root: string;
  /** All leaves indexed by hash */
  Leafs: Record<string, DagLeaf>;
  /** Labels mapping (numeric labels to hashes) */
  Labels?: Record<string, string>;
}

/**
 * Transmission packet for syncing individual leaves
 */
export interface TransmissionPacket {
  /** The leaf being transmitted */
  Leaf: DagLeaf;
  /** Parent hash for context */
  ParentHash: string;
  /** Merkle proofs needed to verify this leaf */
  proofs?: Record<string, ClassicTreeBranch>;
}

/**
 * Configuration for DAG building
 */
export interface DagBuilderConfig {
  /** Enable parallel processing */
  enableParallel?: boolean;
  /** Maximum number of workers (0 = auto) */
  maxWorkers?: number;
  /** Add timestamp to root */
  timestampRoot?: boolean;
  /** Additional metadata for root */
  additionalData?: Record<string, string>;
}

/**
 * Result type for operations that can fail
 */
export class ScionicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScionicError';
  }
}
