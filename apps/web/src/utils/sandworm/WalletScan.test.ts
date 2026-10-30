import { describe, expect, it } from 'vitest';
import { addressCandidates } from './WalletScan';

const evm = '0x52908400098527886E0F7030069857D2E4169EE7';

describe(addressCandidates, () => {
  it('finds an address in a plain argument', () => {
    expect(addressCandidates({ address: evm })).toStrictEqual([evm.toLowerCase()]);
  });

  it('finds an address inside notebook code', () => {
    expect(
      addressCandidates({ code: `select * from transfers where "from" = '${evm}' limit 10` }),
    ).toStrictEqual([evm.toLowerCase()]);
  });

  it('finds addresses in nested arguments', () => {
    expect(addressCandidates({ cells: [{ source: { text: evm } }] })).toStrictEqual([
      evm.toLowerCase(),
    ]);
  });

  it('finds a Tron address', () => {
    expect(addressCandidates(['TJRabPrwbZy45sbavfcjinPJC18kjpRTv8'])).toStrictEqual([
      'tjrabprwbzy45sbavfcjinpjc18kjprtv8',
    ]);
  });

  it('lists an address once', () => {
    expect(addressCandidates([evm, evm.toLowerCase()])).toHaveLength(1);
  });

  it('skips ordinary words, numbers and ids', () => {
    expect(addressCandidates({ title: 'Funding trail', rows: 50, id: 'abc-123' })).toStrictEqual(
      [],
    );
  });

  it('skips values that are not text', () => {
    expect(addressCandidates(null)).toStrictEqual([]);
    expect(addressCandidates(42)).toStrictEqual([]);
  });
});
