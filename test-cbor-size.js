const cbor = require('cbor');

// Match Go's tempLeafData structure EXACTLY
const tempLeafData = {
  ItemName: 'bitcoin.pdf',
  Type: 'file',
  MerkleRoot: Buffer.alloc(0),
  CurrentLinkCount: 0,
  LeafCount: 1,
  ContentSize: 184292,
  DagSize: 0,
  ContentHash: Buffer.from('b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553', 'hex'),
  AdditionalData: [],
};

const encoded = cbor.encode(tempLeafData);
console.log('CBOR size:', encoded.length);
console.log('Hex:', encoded.toString('hex'));
