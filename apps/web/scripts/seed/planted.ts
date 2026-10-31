import { buildClaim, DAY } from './claims';
import type { CaseFacts } from './claims';
import { hex, int, pick, random } from './random';
import type { Scenario } from './scenarios';

/** What a case's planted claims are built from: its kind, what its claims share, when they came and what the real ones say. */
export type CaseContext = {
  scenario: Scenario;
  facts: CaseFacts;
  size: number;
  first: number;
  last: number;
  /** What the case's real claims say, filled in once they are built. */
  statements: string[];
};

/**
 * The ways a planted claim gives itself away, each one only to someone who reads it against the rest of the case. None of them
 * leaves a trace a rule can find: no shared wallet, no repeated hash, no burst of claims at the same minute.
 */
const tells = [
  'recycled_story',
  'net_winner',
  'late_payment',
  'insider_detail',
  'amount_mismatch',
  'too_polished',
] as const;

type Tell = (typeof tells)[number];

/** The answer key for one planted claim. It is written to a file and never to the database. */
type PlantedTruth = { claimId: string; platform: string; tell: Tell; note: string };

type Claim = ReturnType<typeof buildClaim>;

function sumOf(values: number[]) {
  let sum = 0;

  for (const value of values) {
    sum += value;
  }

  return sum;
}

const amountPattern = /\d[\d,]*(?:\.\d+)?/u;

const amountOf = (text: string | null) => {
  const found = text ? amountPattern.exec(text)?.[0] : undefined;

  return found ? Number(found.replaceAll(',', '')) : null;
};

const withAmount = (text: string, value: number) =>
  text.replace(amountPattern, Math.round(value).toLocaleString('en-US'));

const swaps: [RegExp, string][] = [
  [/\bsent\b/gu, 'transferred'],
  [/\bmoney\b/gu, 'funds'],
  [/\bwebsite\b/gu, 'site'],
  [/\bthen\b/gu, 'after that'],
  [/\bsupport\b/gu, 'the help desk'],
  [/\bwithdraw\b/gu, 'take it out'],
];

/** The same account in other words, with its sentences in another order, so it is no copy but is still the same story. */
function retell(statement: string) {
  return statement
    .split(/(?<=\.)\s+/u)
    .toReversed()
    .map((sentence) => {
      let text = sentence;

      for (const [pattern, to] of swaps) {
        text = text.replace(pattern, to);
      }

      return text;
    })
    .join(' ');
}

function insiderSentence() {
  return pick([
    `The desk later told me my balance had been moved to the second-tier queue, the one kept for accounts marked internal-test, under ticket ${hex(5)}.`,
    `I know the treasury wallet rotates on Tuesday nights, because the operations contact warned me before the last rotation that withdrawals would pause.`,
    `Their compliance officer confirmed to me by voice note that my account was in the batch reviewed before the freeze.`,
  ]);
}

const isDigit = (char: string | undefined) => char !== undefined && /\d/u.test(char);

/** Swaps two neighbouring digits near the end of the first amount, the way a typo does, and never leaves a leading zero. */
function swapDigits(text: string) {
  const found = amountPattern.exec(text)?.[0];

  if (!found) {
    return text;
  }

  const digits = Array.from({ length: found.length }, (_, index) => found.charAt(index));
  const positions = digits.flatMap((char, index) =>
    isDigit(char) &&
    isDigit(digits[index + 1]) &&
    char !== digits[index + 1] &&
    !(index === 0 && digits[1] === '0')
      ? [index]
      : [],
  );
  const at = positions.at(-1);

  if (at === undefined) {
    return text;
  }

  const swapped = digits.with(at, digits[at + 1] ?? '').with(at + 1, digits[at] ?? '');

  return text.replace(found, swapped.join(''));
}

function polished(claim: Claim, context: CaseContext) {
  const paid = new Date(claim.submittedAt.getTime() - int(3, 20) * DAY);
  const answered = int(2, 5);

  return `On ${paid.toISOString().slice(0, 10)} at approximately ${String(int(8, 21)).padStart(2, '0')}:${String(int(0, 59)).padStart(2, '0')} UTC, I transferred ${claim.amountLost ?? 'the amount stated'} to ${context.facts.name}. I attempted to withdraw on ${int(2, 6)} further occasions and sent ${answered} written requests, none of which received a substantive reply. I make this account in good faith and can provide the supporting records on request.`;
}

/**
 * Applies one tell to a claim that is otherwise coherent: the same fields filled the way the case's other claims fill them.
 * @param claim - The claim.
 * @param tell - How it gives itself away.
 * @param context - The case.
 * @returns The claim and what to note in the answer key.
 */
function plant(claim: Claim, tell: Tell, context: CaseContext) {
  const base = claim.statement ?? '';

  if (tell === 'recycled_story') {
    const source = pick(context.statements);

    return {
      claim: { ...claim, statement: retell(source) },
      note: 'Another claimant’s account retold: same events in another order, other words.',
    };
  }

  if (tell === 'net_winner') {
    const lost = amountOf(claim.amountLost) ?? 1000;
    const taken = withAmount(claim.amountLost ?? '$1,000', lost * (1.15 + random() * 0.5));

    return {
      claim: {
        ...claim,
        statement: `${base} Before it stopped I had already taken ${taken} out in two withdrawals.`,
      },
      note: 'Says they took out more than they say they lost: a net gain, not a loss.',
    };
  }

  if (tell === 'late_payment') {
    const lastPaid = context.first + int(1, 3) * DAY;

    return {
      claim: {
        ...claim,
        firstPaymentOn: new Date(lastPaid - int(0, 2) * DAY).toISOString().slice(0, 10),
        lastPaymentOn: new Date(lastPaid).toISOString().slice(0, 10),
        statement: `${base} I paid in only days before everything stopped.`,
      },
      note: 'Paid after the first victims had already reported, yet says they paid just before it stopped.',
    };
  }

  if (tell === 'insider_detail') {
    return {
      claim: { ...claim, statement: `${base} ${insiderSentence()}` },
      note: 'Knows internal details of the operation that no depositor would be told.',
    };
  }

  if (tell === 'amount_mismatch') {
    const stated = claim.amountLost ?? '$1,000';

    return {
      claim: {
        ...claim,
        amountLost: swapDigits(stated),
        statement: `${base} In total I sent ${stated}.`,
      },
      note: 'The amount in the account and the amount in the form differ by two digits swapped.',
    };
  }

  return {
    claim: { ...claim, statement: polished(claim, context) },
    note: 'Formal and exact where the case’s other accounts are plain and vague.',
  };
}

/**
 * Builds the planted claims for one case. They are made like the real ones and filed at times the case's real claims also came,
 * and the statement is where they differ. A planted claim looks as good as a real one in every field a rule can read.
 * @param context - The case.
 * @param userIds - A new claimant for each planted claim.
 * @returns The claims and the answer key.
 */
export function buildPlanted(context: CaseContext, userIds: string[]) {
  const truth: PlantedTruth[] = [];
  const claims = userIds.map((userId, position) => {
    const at = Math.min(
      context.facts.now - DAY,
      Math.max(context.first + 4 * DAY, context.first + random() * (context.last - context.first)),
    );
    const built = buildClaim(context.scenario, context.facts, {
      userId,
      submittedAt: at,
      country: context.facts.country.toLowerCase(),
    });
    const tell = tells[position % tells.length] ?? 'recycled_story';
    const planted = plant(built, tell, context);

    truth.push({
      claimId: built.id,
      platform: context.facts.name,
      tell,
      note: planted.note,
    });

    return planted.claim;
  });

  return { claims, truth };
}

/**
 * Shares the planted claims out over the cases, the bigger cases getting more, so no case is made of them.
 * @param sizes - How many real claims each case has.
 * @param total - How many planted claims there are.
 * @returns How many planted claims each case gets.
 */
export function shareOut(sizes: number[], total: number) {
  const all = sumOf(sizes);
  const exact = sizes.map((size) => (size / all) * total);
  const counts = exact.map(Math.floor);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .toSorted((a, b) => b.rest - a.rest);

  for (const { index } of order.slice(0, total - sumOf(counts))) {
    counts[index] = (counts[index] ?? 0) + 1;
  }

  return counts;
}
