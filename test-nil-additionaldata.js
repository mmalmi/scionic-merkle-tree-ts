const cbor = require('cbor');
const crypto = require('crypto');

const contentHashBytes = Buffer.from('5e711d6f709673c266ea39ad5aa81eee8b91b51f49b49bbb2e1f6714c3533be2', 'hex');

// In Go, when additionalData map is nil, SortMapForVerification returns nil
// So the field would have a nil value

const leafData = {
  ItemName: 'file1.txt',
  Type: 'file',
  MerkleRoot: Buffer.alloc(0),
  CurrentLinkCount: 0,
  ContentHash: contentHashBytes,
  AdditionalData: null, // Go nil
};

const encoded = cbor.encode(leafData);
console.log('With AdditionalData: null');
console.log('  CBOR hex:', encoded.toString('hex'));
console.log('  Size:', encoded.length);

const hash = crypto.createHash('sha256').update(encoded).digest();
console.log('  SHA256:', hash.toString('hex'));

// Build CID
const cidBytes = Buffer.concat([Buffer.from([0x01, 0x51, 0x12, 0x20]), hash]);
const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
function base32Encode(data) {
  let bits = 0, value = 0, output = '';
  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += base32Alphabet[(value << (5 - bits)) & 31];
  return output;
}

const cid = 'b' + base32Encode(cidBytes);
console.log('  CID:', cid);
console.log('  Expected: bafireidw3afc7gmy5rltw7tfagx6e6mdwe24dcozzk2keui73wjox2vzfm');
console.log('  Match:', cid === 'bafireidw3afc7gmy5rltw7tfagx6e6mdwe24dcozzk2keui73wjox2vzfm');
