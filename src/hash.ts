/**
 * Hashing and CID utilities for Scionic Merkle Trees
 */

import { createHash } from 'crypto';
import * as cbor from 'cbor';

/**
 * Hash data using SHA256
 */
export function hashData(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

/**
 * Encode varint (variable-length integer)
 */
function encodeVarint(num: number): Uint8Array {
  const bytes: number[] = [];
  while (num >= 0x80) {
    bytes.push((num & 0x7f) | 0x80);
    num >>>= 7;
  }
  bytes.push(num & 0x7f);
  return new Uint8Array(bytes);
}

/**
 * Base32 alphabet (RFC 4648, lowercase)
 */
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/**
 * Encode bytes to base32 (lowercase, RFC 4648)
 */
function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < data.length; i++) {
    value = (value << 8) | data[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Create a CID from CBOR-encoded data
 * Uses CIDv1 with CBOR codec (0x51) and SHA256
 * Matches Go and Rust implementations
 */
export async function createCID(data: any): Promise<string> {
  // Encode to CBOR
  const encoded = cbor.encode(data);

  // Hash with SHA256
  const hash = new Uint8Array(createHash('sha256').update(encoded).digest());

  // Build CID bytes:
  // - version (1 byte): 0x01 (CIDv1)
  // - codec (varint): 0x51 (CBOR)
  // - multihash: 0x12 (SHA2-256) + length + hash
  const version = 0x01;
  const codec = 0x51;
  const hashFunc = 0x12; // SHA2-256
  const hashLen = hash.length;

  // Build the CID bytes
  const cidBytes = new Uint8Array(1 + 1 + 2 + hashLen);
  let offset = 0;

  cidBytes[offset++] = version;
  cidBytes[offset++] = codec;
  cidBytes[offset++] = hashFunc;
  cidBytes[offset++] = hashLen;
  cidBytes.set(hash, offset);

  // Encode to base32 and prepend with 'b' (base32) prefix
  const base32Hash = base32Encode(cidBytes);
  return 'b' + base32Hash;
}

/**
 * Parse a CID string (basic implementation)
 */
export function parseCID(cidString: string): any {
  // This is a simplified parser - just for basic validation
  if (!cidString.startsWith('b')) {
    throw new Error('Invalid CID: must start with base encoding character');
  }
  return { toString: () => cidString };
}

/**
 * Verify CID matches the data
 */
export async function verifyCID(cidString: string, data: any): Promise<boolean> {
  const expectedCID = await createCID(data);
  return cidString === expectedCID;
}
