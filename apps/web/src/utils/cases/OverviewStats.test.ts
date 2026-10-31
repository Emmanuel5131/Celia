import { describe, expect, it } from 'vitest';
import { buildOverview } from './OverviewStats';
import type { OverviewCase, OverviewEvent } from './OverviewStats';

const now = new Date('2026-10-27T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const make = (id: string, over: Partial<OverviewCase> = {}): OverviewCase => ({
  id,
  number: `CB-${id}`,
  name: `Case ${id}`,
  jurisdictions: 1,
  operators: [],
  claimants: 10,
  confirmed: 4,
  description: null,
  status: 'collecting',
  hasReport: false,
  updatedAt: daysAgo(1),
  createdAt: daysAgo(40),
  ...over,
});

const input = (cases: OverviewCase[], events: OverviewEvent[] = []) => ({
  cases,
  events,
  ledByYou: [],
  hashes: {},
  now,
});

describe(buildOverview, () => {
  it('counts open cases and the ones added this week', () => {
    const { stats } = buildOverview(input([make('1', { createdAt: daysAgo(2) }), make('2')]));

    expect(stats.newCases).toBe(2);
    expect(stats.newThisWeek).toBe(1);
  });

  it('adds up the claimants waiting in open cases and the cases they are across', () => {
    const { stats } = buildOverview(
      input([make('1', { claimants: 5 }), make('2', { claimants: 0 })]),
    );

    expect(stats.waitingClaimants).toBe(5);
    expect(stats.acrossCases).toBe(1);
  });

  it('counts the cases the lawyer leads and the ones taken this month', () => {
    const { stats } = buildOverview({
      ...input([]),
      ledByYou: [
        { caseId: 'a', at: daysAgo(3) },
        { caseId: 'b', at: daysAgo(90) },
      ],
    });

    expect(stats.openCases).toBe(2);
    expect(stats.takenThisMonth).toBe(1);
  });

  it('counts sealed files and the ones sealed this month from events', () => {
    const { stats } = buildOverview(
      input(
        [make('1', { status: 'sealed' }), make('2', { status: 'sealed' })],
        [
          { caseId: '1', type: 'case_sealed', count: 1, at: daysAgo(5) },
          { caseId: '2', type: 'case_sealed', count: 1, at: daysAgo(60) },
        ],
      ),
    );

    expect(stats.sealedFiles).toBe(2);
    expect(stats.sealedThisMonth).toBe(1);
  });

  it('shows cases with enough evidence first, then building', () => {
    const { attention } = buildOverview(
      input([make('s', { status: 'sealed' }), make('b', { status: 'building' })]),
    );

    expect(attention.map((c) => c.id)).toStrictEqual(['s', 'b']);
  });

  it('shows at most five cases', () => {
    const { attention } = buildOverview(
      input(['1', '2', '3', '4', '5', '6', '7'].map((id) => make(id))),
    );

    expect(attention).toHaveLength(5);
  });

  it('merges claims added to one case on one day into one line', () => {
    const { activity } = buildOverview(
      input(
        [make('1')],
        [
          { caseId: '1', type: 'claim_added', count: 1, at: '2026-10-26T09:00:00Z' },
          { caseId: '1', type: 'claim_added', count: 1, at: '2026-10-26T15:00:00Z' },
          { caseId: '1', type: 'claim_added', count: 12, at: '2026-10-26T18:00:00Z' },
        ],
      ),
    );

    expect(activity).toHaveLength(1);
    expect(activity[0]).toMatchObject({ kind: 'claims_added', count: 14 });
  });

  it('lists the newest activity first and shows a sealed case with the start of its hash', () => {
    const { activity } = buildOverview({
      ...input(
        [make('1')],
        [
          { caseId: '1', type: 'case_opened', count: 1, at: daysAgo(10) },
          { caseId: '1', type: 'case_sealed', count: 1, at: daysAgo(1) },
        ],
      ),
      hashes: { '1': `0x${'a1b2c3d4e5'.repeat(6)}ffff` },
    });

    expect(activity.map((item) => item.kind)).toStrictEqual(['evidence_sealed', 'case_opened']);
    expect(activity[0]?.hash).toBe('a1b2c3d');
  });

  it('leaves out events for cases that are not in the list', () => {
    const { activity } = buildOverview(
      input([make('1')], [{ caseId: 'elsewhere', type: 'case_opened', count: 1, at: daysAgo(1) }]),
    );

    expect(activity).toHaveLength(0);
  });

  it('shows at most eight lines of activity', () => {
    const events: OverviewEvent[] = Array.from({ length: 12 }, (_, index) => ({
      caseId: '1',
      type: 'report_saved',
      count: 1,
      at: daysAgo(index + 1),
    }));

    expect(buildOverview(input([make('1')], events)).activity).toHaveLength(8);
  });

  it('shows zeros, not placeholders, when there is nothing', () => {
    const { stats, attention, activity } = buildOverview(input([]));

    expect(stats).toStrictEqual({
      newCases: 0,
      newThisWeek: 0,
      openCases: 0,
      takenThisMonth: 0,
      waitingClaimants: 0,
      acrossCases: 0,
      sealedFiles: 0,
      sealedThisMonth: 0,
    });
    expect(attention).toStrictEqual([]);
    expect(activity).toStrictEqual([]);
  });
});
