import { MerkleTree } from './merkleTree';
import { createHash } from 'crypto';

function hash(data: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

describe('MerkleTree', () => {
  test('creates tree from single leaf', () => {
    const leaves = [hash('leaf1')];
    const tree = new MerkleTree(leaves);
    expect(tree.getRoot()).toEqual(leaves[0]);
  });

  test('creates tree from multiple leaves', () => {
    const leaves = [hash('leaf1'), hash('leaf2'), hash('leaf3')];
    const tree = new MerkleTree(leaves);
    const root = tree.getRoot();
    expect(root).toBeDefined();
    expect(root.length).toBe(32); // SHA256 hash size
  });

  test('throws error for empty leaves', () => {
    expect(() => new MerkleTree([])).toThrow('Cannot create Merkle tree with no leaves');
  });

  test('generates valid proof for leaf', () => {
    const leaves = [hash('leaf1'), hash('leaf2'), hash('leaf3'), hash('leaf4')];
    const tree = new MerkleTree(leaves);
    const root = tree.getRoot();

    // Get proof for first leaf
    const proof = tree.getProof(0);
    expect(proof.Siblings.length).toBeGreaterThan(0);

    // Verify the proof
    const isValid = MerkleTree.verify(leaves[0], proof, root);
    expect(isValid).toBe(true);
  });

  test('verifies all leaves', () => {
    const leaves = [hash('a'), hash('b'), hash('c'), hash('d'), hash('e')];
    const tree = new MerkleTree(leaves);
    const root = tree.getRoot();

    // Verify each leaf
    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      const isValid = MerkleTree.verify(leaves[i], proof, root);
      expect(isValid).toBe(true);
    }
  });

  test('rejects invalid proof', () => {
    const leaves = [hash('leaf1'), hash('leaf2'), hash('leaf3')];
    const tree = new MerkleTree(leaves);
    const root = tree.getRoot();

    const proof = tree.getProof(0);

    // Verify with wrong leaf
    const wrongLeaf = hash('wrong');
    const isValid = MerkleTree.verify(wrongLeaf, proof, root);
    expect(isValid).toBe(false);
  });

  test('handles odd number of leaves', () => {
    const leaves = [hash('1'), hash('2'), hash('3')];
    const tree = new MerkleTree(leaves);
    const root = tree.getRoot();

    // All leaves should verify
    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      expect(MerkleTree.verify(leaves[i], proof, root)).toBe(true);
    }
  });

  test('produces deterministic root', () => {
    const leaves = [hash('a'), hash('b'), hash('c')];
    const tree1 = new MerkleTree(leaves);
    const tree2 = new MerkleTree(leaves);

    expect(tree1.getRoot()).toEqual(tree2.getRoot());
  });

  test('throws error for invalid leaf index', () => {
    const leaves = [hash('a'), hash('b')];
    const tree = new MerkleTree(leaves);

    expect(() => tree.getProof(-1)).toThrow('Leaf index out of bounds');
    expect(() => tree.getProof(2)).toThrow('Leaf index out of bounds');
  });

  test('getLeafCount returns correct count', () => {
    const leaves = [hash('a'), hash('b'), hash('c')];
    const tree = new MerkleTree(leaves);
    expect(tree.getLeafCount()).toBe(3);
  });
});
