const cbor = require('cbor');
const crypto = require('crypto');

const contentHashBytes = Buffer.from('5e711d6f709673c266ea39ad5aa81eee8b91b51f49b49bbb2e1f6714c3533be2', 'hex');

const variants = [
  { name: 'AdditionalData: []', data: [] },
  { name: 'AdditionalData: null', data: null },
  { name: 'AdditionalData: undefined', data: undefined },
];

for (const variant of variants) {
  const leafData = {
    ItemName: 'file1.txt',
    Type: 'file',
    MerkleRoot: Buffer.alloc(0),
    CurrentLinkCount: 0,
    ContentHash: contentHashBytes,
    AdditionalData: variant.data,
  };

  // Filter out undefined
  const filtered = {};
  for (const [k, v] of Object.entries(leafData)) {
    if (v !== undefined) {
      filtered[k] = v;
    }
  }

  const encoded = cbor.encode(filtered);
  const hash = crypto.createHash('sha256').update(encoded).digest();

  console.log(variant.name);
  console.log('  CBOR size:', encoded.length);
  console.log('  CBOR hex:', encoded.toString('hex'));
  console.log('  SHA256:', hash.toString('hex'));
  console.log('');
}

// What Go likely uses
console.log('Expected file1.txt hash from Go: bafireidw3afc7gmy5rltw7tfagx6e6mdwe24dcozzk2keui73wjox2vzfm');
