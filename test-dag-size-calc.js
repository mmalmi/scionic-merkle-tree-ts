const cbor = require('cbor');

const contentHashBytes = Buffer.from('b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553', 'hex');

// This is what we use for SIZE calculation (with DagSize=0)
const tempForSize = {
  ItemName: 'bitcoin.pdf',
  Type: 'file',
  MerkleRoot: Buffer.alloc(0),
  CurrentLinkCount: 0,
  LeafCount: 1,
  ContentSize: 184292,
  DagSize: 0,
  ContentHash: contentHashBytes,
  AdditionalData: [],
};

const tempEncoded = cbor.encode(tempForSize);
console.log('Temp (DagSize=0) CBOR size:', tempEncoded.length);

// With calculated DagSize=161
const finalForHash = {
  ItemName: 'bitcoin.pdf',
  Type: 'file',
  MerkleRoot: Buffer.alloc(0),
  CurrentLinkCount: 0,
  LeafCount: 1,
  ContentSize: 184292,
  DagSize: 161,  // Using calculated value
  ContentHash: contentHashBytes,
  AdditionalData: [],
};

const finalEncoded = cbor.encode(finalForHash);
console.log('Final (DagSize=161) CBOR size:', finalEncoded.length);

console.log('\nSo the calculation should be:');
console.log('  childrenDagSize = 0 (no children)');
console.log('  tempSize = ' + tempEncoded.length);
console.log('  finalDagSize = 0 + ' + tempEncoded.length + ' = ' + tempEncoded.length);
console.log('  Then use DagSize=' + tempEncoded.length + ' in the final hash');
