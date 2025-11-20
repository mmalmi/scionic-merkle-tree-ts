import { MerkleTree } from '../src/merkleTree';
import { createHash } from 'crypto';

function hash(data: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

describe('Merkle Tree Debug', () => {
  test('debug 5 leaf tree verification', () => {
    const leaves = [hash('a'), hash('b'), hash('c'), hash('d'), hash('e')];
    const tree = new MerkleTree(leaves);
    const root = tree.getRoot();

    console.log(`\nTree with ${leaves.length} leaves:`);

    // Test each leaf
    for (let i = 0; i < leaves.length; i++) {
      const proof = tree.getProof(i);
      console.log(`\nLeaf ${i}:`);
      console.log(`  Siblings: ${proof.Siblings.length}`);
      console.log(`  Path (binary): ${proof.Path.toString(2).padStart(8, '0')}`);

      // Manually verify the proof
      let current = leaves[i];
      for (let j = 0; j < proof.Siblings.length; j++) {
        const sibling = proof.Siblings[j];
        const siblingOnRight = (proof.Path & (1 << j)) !== 0;

        console.log(`  Level ${j}: sibling on ${siblingOnRight ? 'right' : 'left'}`);

        if (siblingOnRight) {
          // Sibling on right, we're on left
          current = hashPair(current, sibling);
        } else {
          // Sibling on left, we're on right
          current = hashPair(sibling, current);
        }
      }

      const isValid = MerkleTree.verify(leaves[i], proof, root);
      const manualMatch = current.every((val, idx) => val === root[idx]);

      console.log(`  Result: verify=${isValid}, manual=${manualMatch}`);

      if (!isValid) {
        console.log(`  FAILED for leaf ${i}`);
      }
    }
  });
});

function hashPair(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return new Uint8Array(createHash('sha256').update(combined).digest());
}
