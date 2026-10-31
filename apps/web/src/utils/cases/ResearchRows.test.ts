import { describe, expect, it } from 'vitest';
import { researchRows } from './ResearchRows';

const statement = {
  id: 's1',
  text: 'Withdrawals are always available.',
  sourceUrl: 'https://example.com/faq',
  kind: 'withdrawals' as const,
};

describe(researchRows, () => {
  it('takes the verdict from the one check of the report', () => {
    const [row] = researchRows(
      [
        {
          statement,
          state: 'reported',
          plan: { run: 2 },
          report: { snapshot: { checks: [{ result: 'proven' }] } },
        },
      ],
      (item) => `/r/${item.run}`,
    );

    expect(row).toMatchObject({ result: 'proven', href: '/r/2', state: 'reported' });
  });

  it('has no verdict before there is a report', () => {
    const [row] = researchRows(
      [{ statement, state: 'not_researched', plan: null, report: null }],
      () => null,
    );

    expect(row).toMatchObject({ result: null, href: null });
  });

  it('keeps the order of the statements', () => {
    const rows = researchRows(
      [
        { statement, state: 'researching', plan: { run: 1 }, report: null },
        {
          statement: { ...statement, id: 's2' },
          state: 'not_researched',
          plan: null,
          report: null,
        },
      ],
      () => null,
    );

    expect(rows.map((row) => row.id)).toStrictEqual(['s1', 's2']);
  });
});
