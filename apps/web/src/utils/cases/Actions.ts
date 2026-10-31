import type { CaseEvidence } from '@/libs/analysis/Evidence';

/**
 * The kinds of action staff can pick, stored by these keys and shown in the reader's language. Anything else is the staff member's
 * own words, stored as typed.
 */
export const actionKindPresets = [
  'statement',
  'deposits',
  'withdrawals',
  'funds_moved',
  'promotion',
] as const;

/**
 * Whether a kind is one of the presets, which have a translated name, and not a staff member's own words.
 * @param kind - The kind as stored.
 * @returns True for a preset.
 */
export function isActionKindPreset(kind: string): kind is (typeof actionKindPresets)[number] {
  return (actionKindPresets as readonly string[]).includes(kind);
}

/** One alleged action as a table row: what was alleged, when and where, and how much evidence is attached on and off the chain. */
export type ActionRow = {
  id: string;
  /** What kind of action it is, in staff's own words. */
  kind: string | null;
  title: string;
  note: string | null;
  occurredOn: string | null;
  jurisdiction: string | null;
  onChain: number;
  offChain: number;
};

type ActionSource = Omit<ActionRow, 'onChain' | 'offChain'>;

/**
 * Turns a case's alleged actions into table rows, counting the evidence attached to each one: on chain (wallets and
 * transactions) and off chain (videos, pictures, documents and links).
 * @param actions - The alleged actions.
 * @param evidence - The case's evidence.
 * @returns One row for each action, in the order given.
 */
export function actionRows(
  actions: ActionSource[],
  evidence: Pick<CaseEvidence, 'actionId' | 'source'>[],
): ActionRow[] {
  return actions.map((action) => {
    const attached = evidence.filter((item) => item.actionId === action.id);

    return {
      ...action,
      onChain: attached.filter((item) => item.source === 'on_chain').length,
      offChain: attached.filter((item) => item.source === 'off_chain').length,
    };
  });
}
