import { createHash } from 'node:crypto';
import type { ChainId } from '@celia/core';
import { chainFamily } from '@celia/core';
import { hex, int } from './random';

const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest();

function base58Encode(bytes: Buffer) {
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let text = '';

  while (value > 0n) {
    text = base58[Number(value % 58n)] + text;
    value /= 58n;
  }

  return '1'.repeat(bytes.findIndex((byte) => byte !== 0)) + text;
}

/** A Tron address with the right prefix and checksum, so it passes the form's check but has never been used. */
function tronAddress() {
  const body = Buffer.from([0x41, ...Array.from({ length: 20 }, () => int(0, 255))]);

  return base58Encode(Buffer.concat([body, sha256(sha256(body)).subarray(0, 4)]));
}

/** A legacy Bitcoin address with the right version and checksum, so it passes the form's check but has never been used. */
function bitcoinAddress() {
  const body = Buffer.from([0x00, ...Array.from({ length: 20 }, () => int(0, 255))]);

  return base58Encode(Buffer.concat([body, sha256(sha256(body)).subarray(0, 4)]));
}

/**
 * An address that is valid for its chain and has never been used, so it is real in shape and empty on the chain.
 * @param chain - The chain.
 * @returns The address.
 */
export function emptyAddress(chain: ChainId) {
  const family = chainFamily(chain);

  if (family === 'tron') {
    return tronAddress();
  }

  if (family === 'solana') {
    // A 32-byte key written in base58 is 43 or 44 characters; this one is always 44 so it decodes to 32 bytes.
    return base58Encode(Buffer.from(Array.from({ length: 32 }, () => int(1, 255))));
  }

  if (family === 'bitcoin') {
    return bitcoinAddress();
  }

  return `0x${hex(40)}`;
}

/**
 * Public, busy addresses a strong claim can name, so the check that asks the chain finds activity. They are token contracts, not
 * people's wallets.
 */
const activeAddresses: Partial<Record<ChainId, string[]>> = {
  tron: ['TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'],
  ethereum: [
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  ],
  bsc: ['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'],
  solana: [
    'So11111111111111111111111111111111111111112',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  ],
};

/**
 * An address that has been used on the chain, or an empty one for a chain with none to offer.
 * @param chain - The chain.
 * @returns The address.
 */
export function activeAddress(chain: ChainId) {
  const options = activeAddresses[chain];

  return options?.[int(0, options.length - 1)] ?? emptyAddress(chain);
}
