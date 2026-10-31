import { setTimeout } from 'node:timers/promises';
import { chainFamily, isValidAddress } from '@celia/core';
import type { ChainId } from '@celia/core';
import * as z from 'zod';
import { evmEndpoints, rpcCall, solanaEndpoint } from '@/libs/claims/ChainRpc';

/** What the chain says of an address: it has been used, it never has been, or we could not tell. */
export type WalletActivity = 'active' | 'empty' | 'unknown';

const quantity = z.string().transform(BigInt);
const unknown = () => 'unknown' as const;

// Busy addresses are asked about once: a settled answer is kept for an hour, so a dry run and the run after it share the work.
const settled = new Map<string, { answer: WalletActivity; until: number }>();
const settledFor = 60 * 60 * 1000;

async function evmActivity(chain: ChainId, address: string): Promise<WalletActivity> {
  const url = evmEndpoints[chain];

  if (!url) {
    return 'unknown';
  }

  const [count, balance] = await Promise.all([
    rpcCall(url, 'eth_getTransactionCount', [address, 'latest']),
    rpcCall(url, 'eth_getBalance', [address, 'latest']),
  ]);

  // An address that has sent something has a count; one that was only ever paid has a balance or has had tokens.
  return quantity.parse(count) > 0n || quantity.parse(balance) > 0n ? 'active' : 'empty';
}

async function solanaActivity(address: string): Promise<WalletActivity> {
  const signatures = z
    .array(z.unknown())
    .parse(await rpcCall(solanaEndpoint, 'getSignaturesForAddress', [address, { limit: 1 }]));

  return signatures.length > 0 ? 'active' : 'empty';
}

async function tronAccount(address: string, retry = true): Promise<Response> {
  const response = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, {
    signal: AbortSignal.timeout(6000),
  });

  if (response.status === 429 && retry) {
    // The free node allows only a few asks a second; one pause usually clears it.
    await setTimeout(1500);

    return await tronAccount(address, false);
  }

  return response;
}

async function tronActivity(address: string): Promise<WalletActivity> {
  const response = await tronAccount(address);

  if (!response.ok) {
    return 'unknown';
  }

  // An account that was never paid does not exist yet, so the node returns no data for it.
  const { data } = z.object({ data: z.array(z.unknown()) }).parse(await response.json());

  return data.length > 0 ? 'active' : 'empty';
}

async function lookUp(chain: ChainId, address: string): Promise<WalletActivity> {
  const family = chainFamily(chain);

  if (family === 'evm') {
    return await evmActivity(chain, address).catch(unknown);
  }

  if (family === 'solana') {
    return await solanaActivity(address).catch(unknown);
  }

  if (family === 'tron') {
    return await tronActivity(address).catch(unknown);
  }

  return 'unknown';
}

/**
 * Asks the chain whether an address has ever been used. An address that is not valid for its chain has not been, so it is empty
 * without asking. A chain we cannot look up, a slow node or an answer we cannot read gives `unknown`, never `empty`, so a failed
 * lookup is never held against a person.
 * @param chain - The chain.
 * @param address - The address.
 * @returns Whether it has activity.
 */
export async function walletActivity(chain: ChainId, address: string): Promise<WalletActivity> {
  if (!isValidAddress(chain, address)) {
    return 'empty';
  }

  const key = `${chain}:${address}`;
  const known = settled.get(key);

  if (known && known.until > Date.now()) {
    return known.answer;
  }

  const answer = await lookUp(chain, address);

  if (answer !== 'unknown') {
    settled.set(key, { answer, until: Date.now() + settledFor });
  }

  return answer;
}
