const cbor = require('cbor');
const crypto = require('crypto');

const contentHashBytes = Buffer.from('b1674191a88ec5cdd733e4240a81803105dc412d6c6708d53ab94fc248f4f553', 'hex');

// This is what Go uses for FINAL HASH (with DagSize=161)
const finalLeafData = {
  ItemName: 'bitcoin.pdf',
  Type: 'file',
  MerkleRoot: Buffer.alloc(0),
  CurrentLinkCount: 0,
  LeafCount: 1,
  ContentSize: 184292,
  DagSize: 161,
  ContentHash: contentHashBytes,
  AdditionalData: [],
};

const encoded = cbor.encode(finalLeafData);
console.log('Final CBOR size:', encoded.length);
console.log('Final CBOR hex:', encoded.toString('hex'));

// Hash it
const hash = crypto.createHash('sha256').update(encoded).digest();
console.log('\nSHA256:', hash.toString('hex'));

// Build CID
const cidBytes = Buffer.concat([
  Buffer.from([0x01, 0x51, 0x12, 0x20]),
  hash
]);

const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
function base32Encode(data) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += base32Alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

const cid = 'b' + base32Encode(cidBytes);
console.log('Calculated CID:', cid);
console.log('\nExpected Go CID: bafireign7yfvtni25wlzwj6hm7zlrkq3ecxdlpifisu5y5d4kynug2bgyy');
console.log('Match:', cid === 'bafireign7yfvtni25wlzwj6hm7zlrkq3ecxdlpifisu5y5d4kynug2bgyy');
