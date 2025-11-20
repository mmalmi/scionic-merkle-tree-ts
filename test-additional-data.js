const cbor = require('cbor');

const contentHashBytes = Buffer.from('b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553', 'hex');

const variants = [
  { name: 'AdditionalData: []', data: [] },
  { name: 'AdditionalData: {}', data: {} },
  { name: 'AdditionalData: null', data: null },
];

for (const variant of variants) {
  const tempLeafData = {
    ItemName: 'bitcoin.pdf',
    Type: 'file',
    MerkleRoot: Buffer.alloc(0),
    CurrentLinkCount: 0,
    LeafCount: 1,
    ContentSize: 184292,
    DagSize: 0,
    ContentHash: contentHashBytes,
    AdditionalData: variant.data,
  };

  const encoded = cbor.encode(tempLeafData);
  console.log(variant.name + ': ' + encoded.length + ' bytes');
}
