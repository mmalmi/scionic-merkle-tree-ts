const cbor = require('cbor');

const contentHashBytes = Buffer.from('b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553', 'hex');

console.log('Testing ContentHash encoding:');
console.log('  As array:', cbor.encode([...contentHashBytes]).toString('hex'));
console.log('  As Buffer:', cbor.encode(contentHashBytes).toString('hex'));
console.log('  As Uint8Array:', cbor.encode(new Uint8Array(contentHashBytes)).toString('hex'));

console.log('\nTesting MerkleRoot encoding:');
console.log('  As Buffer.alloc(0):', cbor.encode(Buffer.alloc(0)).toString('hex'));
console.log('  As []:', cbor.encode([]).toString('hex'));

// Test the full structure with proper types
const tempLeafData = {
  ItemName: 'bitcoin.pdf',
  Type: 'file',
  MerkleRoot: Buffer.alloc(0),  // Should be 40 (empty bytes)
  CurrentLinkCount: 0,
  LeafCount: 1,
  ContentSize: 184292,
  DagSize: 0,
  ContentHash: contentHashBytes,  // Should be encoded as bytes not array
  AdditionalData: [],
};

const encoded = cbor.encode(tempLeafData);
console.log('\nFull encoding:');
console.log('  Size:', encoded.length);
console.log('  Hex:', encoded.toString('hex'));

const goHex = 'a9684974656d4e616d656b626974636f696e2e70646664547970656466696c656a4d65726b6c65526f6f74407043757272656e744c696e6b436f756e7400694c656166436f756e74016b436f6e74656e7453697a651a0002cfe46744616753697a65006b436f6e74656e74486173685820b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f5536e4164646974696f6e616c4461746180';
console.log('\nComparison:');
console.log('  Match:', encoded.toString('hex') === goHex);
