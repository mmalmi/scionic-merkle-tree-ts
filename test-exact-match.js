const cbor = require('cbor');

// Try different field orders to match Go exactly
const variants = [
  {
    name: 'Current order',
    data: {
      ItemName: 'bitcoin.pdf',
      Type: 'file',
      MerkleRoot: Buffer.alloc(0),
      CurrentLinkCount: 0,
      LeafCount: 1,
      ContentSize: 184292,
      DagSize: 0,
      ContentHash: Buffer.from('b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553', 'hex'),
      AdditionalData: [],
    }
  },
  {
    name: 'AdditionalData as map',
    data: {
      ItemName: 'bitcoin.pdf',
      Type: 'file',
      MerkleRoot: Buffer.alloc(0),
      CurrentLinkCount: 0,
      LeafCount: 1,
      ContentSize: 184292,
      DagSize: 0,
      ContentHash: Buffer.from('b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553', 'hex'),
      AdditionalData: {},
    }
  },
];

for (const variant of variants) {
  const encoded = cbor.encode(variant.data);
  console.log(variant.name + ': ' + encoded.length + ' bytes');
  console.log('  First 50 hex: ' + encoded.slice(0, 50).toString('hex'));
}

// What Go produces (from earlier test)
const goHex = 'a9684974656d4e616d656b626974636f696e2e70646664547970656466696c656a4d65726b6c65526f6f74407043757272656e744c696e6b436f756e7400694c656166436f756e74016b436f6e74656e7453697a651a0002cfe46744616753697a65006b436f6e74656e74486173685820b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f5536e4164646974696f6e616c4461746180';
console.log('\nGo hex: ' + goHex);
console.log('Go size: ' + Buffer.from(goHex, 'hex').length + ' bytes');
