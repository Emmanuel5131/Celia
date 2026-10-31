import { describe, expect, it } from 'vitest';
import { actionRows } from '@/utils/cases/Actions';

const action = {
  id: 'a1',
  kind: 'Withdrawals',
  title: 'Stopped withdrawals',
  note: null,
  occurredOn: null,
  jurisdiction: null,
};

describe('Action rows', () => {
  it('counts the evidence on and off the chain for each action', () => {
    const rows = actionRows(
      [action, { ...action, id: 'a2' }],
      [
        { actionId: 'a1', source: 'on_chain' },
        { actionId: 'a1', source: 'off_chain' },
        { actionId: 'a1', source: 'off_chain' },
        { actionId: 'a2', source: 'on_chain' },
        { actionId: null, source: 'off_chain' },
      ],
    );

    expect(rows.map((row) => [row.onChain, row.offChain])).toStrictEqual([
      [1, 2],
      [1, 0],
    ]);
  });

  it('gives an action with no evidence zero counts', () => {
    expect(actionRows([action], [])[0]).toMatchObject({ onChain: 0, offChain: 0 });
  });
});
