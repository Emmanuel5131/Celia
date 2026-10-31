import type { CaseEventType } from '@/models/Schema';
import type { CaseRow } from '@/utils/cases/Case';

export type OverviewCase = CaseRow & { createdAt: string };

export type OverviewEvent = { caseId: string; type: CaseEventType; count: number; at: string };

type ActivityKind =
  | 'case_opened'
  | 'claims_added'
  | 'report_saved'
  | 'evidence_sealed'
  | 'case_taken';

/** One line of the activity feed. */
export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  caseId: string;
  case: string;
  /** For claims added: how many. */
  count?: number;
  /** ISO time. */
  at: string;
  /** For a sealed case: the start of its report hash. */
  hash?: string;
};

const dayMs = 24 * 60 * 60 * 1000;

// Cases with enough evidence first, then cases building evidence, then cases still collecting claims.
const priority = { sealed: 0, building: 1, collecting: 2 } as const;

const kinds: Record<CaseEventType, ActivityKind> = {
  case_opened: 'case_opened',
  claim_added: 'claims_added',
  report_saved: 'report_saved',
  case_sealed: 'evidence_sealed',
  case_taken: 'case_taken',
};

/**
 * Works out everything the lawyer's overview shows from the cases and events it is given: the four headline numbers, the cases
 * that need attention, and the activity feed. It reads nothing and invents nothing, so every figure on the page traces back
 * to a row.
 * @param input - The facts.
 * @param input.cases - The cases to show.
 * @param input.events - What happened to those cases, in any order.
 * @param input.ledByYou - The cases the lawyer leads, and when they took each.
 * @param input.hashes - The newest report hash of each case, by case id.
 * @param input.now - The current time.
 * @returns The stats, the cases that need attention (at most five) and the activity (at most eight lines).
 */
export function buildOverview(input: {
  cases: OverviewCase[];
  events: OverviewEvent[];
  ledByYou: { caseId: string; at: string }[];
  hashes: Record<string, string>;
  now: Date;
}) {
  const since = (days: number) => input.now.getTime() - days * dayMs;
  const after = (iso: string, days: number) => new Date(iso).getTime() >= since(days);
  const open = input.cases;
  const names = new Map(input.cases.map((c) => [c.id, c.name]));

  const stats = {
    newCases: open.length,
    newThisWeek: open.filter((c) => after(c.createdAt, 7)).length,
    openCases: input.ledByYou.length,
    takenThisMonth: input.ledByYou.filter((c) => after(c.at, 30)).length,
    waitingClaimants: open.reduce((total, c) => total + c.claimants, 0),
    acrossCases: open.filter((c) => c.claimants > 0).length,
    sealedFiles: input.cases.filter((c) => c.status === 'sealed').length,
    sealedThisMonth: input.events.filter((e) => e.type === 'case_sealed' && after(e.at, 30)).length,
  };

  const attention = open
    .toSorted(
      (a, b) => priority[a.status] - priority[b.status] || b.updatedAt.localeCompare(a.updatedAt),
    )
    .slice(0, 5)
    .map(({ createdAt: _createdAt, ...row }): CaseRow => row);

  // Claims added on the same day to the same case read as one line: "14 claims were added".
  const merged = new Map<string, ActivityItem>();

  for (const event of input.events.toSorted((a, b) => b.at.localeCompare(a.at))) {
    const name = names.get(event.caseId);

    if (name) {
      const kind = kinds[event.type];
      const key =
        kind === 'claims_added'
          ? `${event.caseId}|${event.at.slice(0, 10)}`
          : `${event.caseId}|${event.type}|${event.at}`;
      const known = merged.get(key);

      if (known) {
        known.count = (known.count ?? 0) + event.count;
      } else {
        merged.set(key, {
          id: key,
          kind,
          caseId: event.caseId,
          case: name,
          count: kind === 'claims_added' ? event.count : undefined,
          at: event.at,
          hash: kind === 'evidence_sealed' ? input.hashes[event.caseId]?.slice(2, 9) : undefined,
        });
      }
    }
  }

  return { stats, attention, activity: [...merged.values()].slice(0, 8) };
}
