const cbor = require('cbor');

// Test how DagSize encoding changes with value
const testValues = [0, 23, 24, 255, 256, 65535, 65536, 689, 693];

for (const dagSize of testValues) {
  const data = {
    ItemName: 'input',
    Type: 'directory',
    MerkleRoot: Buffer.from('1234567890123456789012345678901234567890123456789012345678901234', 'hex'),
    CurrentLinkCount: 2,
    LeafCount: 3,
    ContentSize: 46,
    DagSize: dagSize,
    ContentHash: null,
    AdditionalData: [],
  };

  const encoded = cbor.encode(data);
  console.log('DagSize=' + dagSize + ': ' + encoded.length + ' bytes');
}
