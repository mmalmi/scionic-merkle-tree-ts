/**
 * Scionic Merkle Tree - TypeScript Implementation
 *
 * A TypeScript implementation of Scionic Merkle Trees, combining the strengths of
 * Classic Merkle Trees and Merkle DAGs.
 *
 * @packageDocumentation
 */

// Export types
export * from './types';

// Export core functionality
export { MerkleTree } from './merkleTree';
export { DagLeafBuilder } from './leaf';
export { createDag, verifyDag, createDirectory } from './dag';
export { toCBOR, fromCBOR, toJSON, fromJSON, saveToFile, loadFromFile } from './serialize';
export { createCID, parseCID, verifyCID, hashData } from './hash';

// Export Labels/LeafSync protocol
export {
  calculateLabels,
  clearLabels,
  getHashesByLabelRange,
  getLabel,
  getHashByLabel,
  iterateDag,
} from './labels';

// Export Transmission protocol
export {
  getLeafSequence,
  applyTransmissionPacket,
  verifyTransmissionPacket,
  applyAndVerifyTransmissionPacket,
} from './transmission';

// Export Partial DAG support
export { getPartial, isPartial } from './partial';

// Export Diff support
export {
  diff,
  diffFromNewLeaves,
  applyDiffToDag,
  createPartialDagFromDiff,
  getAddedLeaves,
  getRemovedLeaves,
  DiffType,
  type LeafDiff,
  type DiffSummary,
  type DagDiff,
} from './diff';

// Export Streaming support
export {
  StreamingDagBuilder,
  createDagFromStream,
  createDagFromBuffer,
} from './streaming';

// Version
export const VERSION = '0.1.0';
