import type {
  AccountKind,
  ChainId,
  ContactChannel,
  FraudType,
  NotificationType,
  OptionalCategory,
  PaymentMethod,
  WalletApp,
  WalletType,
} from '@celia/core';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  ApplicationLookups,
  ApplicationStatus,
  InstitutionKind,
  ReviewCheck,
} from '@/utils/accounts/Institution';
import type { CaseStatus } from '@/utils/cases/Case';
import type { OwnershipMethod } from '@/utils/claims/Ownership';
import type { StoredCheck } from '@/utils/claims/Transaction';
import type { Report } from '@/validations/ReportValidation';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// It automatically run the command `db-server:file`, which apply the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `npm run db:migrate` and there is no need to restart the server.

// Need a database for production? Check out https://get.neon.com/BMFYNtx
// Tested and compatible with Next.js Boilerplate

export const counterSchema = pgTable('counter', {
  id: serial('id').primaryKey(),
  count: integer('count').default(0),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/**
 * One person's claim: a wallet that lost money to one platform, and what they say happened. Claims for the same platform
 * (`platformKey`) are pooled into a case later. The statement and the link between a person and a wallet are private: they
 * are shown only to that person and, once a case is taken, to the counsel handling it.
 */
export const claimSchema = pgTable(
  'claim',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** The Clerk user id of the person who filed the claim. */
    userId: text('user_id').notNull(),
    /** What kind of loss this is, in a victim's words. See `fraudTypes` in `@celia/core`. */
    fraudType: text('fraud_type').$type<FraudType>().notNull().default('other'),
    /** Every kind of loss the person says fits, the first being `fraudType`. A case can fit more than one. */
    fraudTypes: text('fraud_types').array().$type<FraudType[]>().notNull().default([]),
    /** How the money left: their own wallet, an exchange account, a crypto ATM, or a peer-to-peer purchase. */
    paymentMethod: text('payment_method').$type<PaymentMethod>().notNull().default('wallet'),
    /** The chain, as an id from `@celia/core`: `ethereum`, `tron`, `solana`, and so on. */
    chain: text('chain').$type<ChainId>().notNull(),
    /** Their own wallet, when they paid from one. Empty for exchange, ATM and peer-to-peer payments. */
    walletAddress: text('wallet_address'),
    /** The transaction that sent the money. Required when there is no wallet to sign with. */
    txHash: text('tx_hash'),
    /** Who took the money. Empty when they do not know. */
    platformName: text('platform_name'),
    /** The name reduced to letters and digits, so spellings of one name pool together. */
    platformKey: text('platform_key'),
    platformUrl: text('platform_url'),
    /** The website's host without `www.`, so two claims naming the same site pool together. */
    platformHost: text('platform_host'),
    /** A Telegram, X or other handle the operator used. */
    operatorHandle: text('operator_handle'),
    /** The token contract, for a rug pull. Lowercased so spellings match. */
    tokenContract: text('token_contract'),
    /** What kind of fraud it was, in the person's own words, when none of the listed kinds fitted. */
    fraudDescription: text('fraud_description'),
    /** The token or NFT's name and symbol, in the person's own words, such as "Moon Inu (MINU)". */
    tokenName: text('token_name'),
    /** The kind of wallet the money left from, when it was their own. */
    walletType: text('wallet_type').$type<WalletType>(),
    /** What kind of account the wallet is on its chain, read from the chain when the claim was filed. Empty when it could not be. */
    accountKind: text('account_kind').$type<AccountKind>(),
    /** The named wallet, such as MetaMask or Phantom, when they said. */
    walletApp: text('wallet_app').$type<WalletApp>(),
    /** The transaction that first funded the wallet, when they gave it. It lets us trace where the money came from. */
    fundingTxHash: text('funding_tx_hash'),
    /** What the chain showed for the funding transaction when the claim was saved. Empty when it could not be asked. */
    fundingTxCheck: jsonb('funding_tx_check').$type<StoredCheck>(),
    /** What the chain showed for the transaction that sent the money when the claim was saved. */
    txCheck: jsonb('tx_check').$type<StoredCheck>(),
    /** The address they sent the money to, such as the platform's deposit address, when they have it. It lets us follow the money. */
    destinationAddress: text('destination_address'),
    /** When they first and last paid, as `YYYY-MM-DD`. It gives the case a timeline. */
    firstPaymentOn: date('first_payment_on', { mode: 'string' }),
    lastPaymentOn: date('last_payment_on', { mode: 'string' }),
    /** What they sent, in their own words, such as USDT or ETH. */
    assetSent: text('asset_sent'),
    contactChannel: text('contact_channel').$type<ContactChannel>(),
    /** What they say they lost, in their own words. Not confirmed: the chain works out the real figure. */
    amountLost: text('amount_lost'),
    /** What they were promised, by whom and where, and what happened, in their own words. Not confirmed by the chain. */
    statement: text('statement'),
    country: text('country'),
    /** `unsigned` until the wallet is confirmed; `review` while staff look at the documents the person sent; `signed` once confirmed. */
    ownership: text('ownership').notNull().default('unsigned'),
    /** How a confirmed wallet was confirmed: `signature` from the wallet itself, or `staff` from documents. */
    ownershipMethod: text('ownership_method').$type<OwnershipMethod>(),
    /** The link to the video they made to explain their case and show the wallet, when that is what they sent. */
    reviewVideoUrl: text('review_video_url'),
    /** What the person told staff about what they sent. */
    proofNote: text('proof_note'),
    /** When the person last added a video or files, which puts the claim in the staff queue in order. Empty when they added none. */
    reviewRequestedAt: timestamp('review_requested_at', { mode: 'date' }),
    /** When staff last looked at the video and files and found them good. A new video or file clears it, so they look again. */
    reviewedAt: timestamp('reviewed_at', { mode: 'date' }),
    /** Why staff could not confirm the wallet from the documents. Shown to the person, who can try again. */
    reviewNote: text('review_note'),
    /** The one-time value in the message to sign, so a signature cannot be reused for another claim. */
    nonce: text('nonce').notNull(),
    signature: text('signature'),
    signedAt: timestamp('signed_at', { mode: 'date' }),
    /** `draft` while the person is still filling it in, `submitted` once they send it. */
    status: text('status').notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { mode: 'date' }),
    /** When the person agreed that the claim can be shared with the people working on their case; set when they send it. */
    consentedAt: timestamp('consented_at', { mode: 'date' }),
    /** When Celia staff checked the sent claim and its evidence; null until they have. */
    validatedAt: timestamp('validated_at', { mode: 'date' }),
    /** When a member of staff started reviewing the sent claim; shown to the person as "In review". */
    staffReviewStartedAt: timestamp('staff_review_started_at', { mode: 'date' }),
    /** When staff rejected the claim, with the reason the person sees. A rejected claim is never validated. */
    rejectedAt: timestamp('rejected_at', { mode: 'date' }),
    rejectionNote: text('rejection_note'),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    unique('claim_one_wallet_per_platform').on(
      table.userId,
      table.chain,
      table.walletAddress,
      table.platformKey,
    ),
  ],
);

/**
 * An extra wallet on a claim, beyond the main one the claim itself holds: a wallet of the person's that was affected, or a wallet
 * that received their money, on any chain. A claim can list several of each, so the evidence is collected whole. Rows are only
 * written with the claim; they are not claims of their own.
 */
export const claimAddressSchema = pgTable(
  'claim_address',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claimSchema.id),
    /** `affected` for the person's own wallet that was hit; `receiving` for a wallet that received their money. */
    role: text('role').$type<'affected' | 'receiving'>().notNull(),
    chain: text('chain').$type<ChainId>().notNull(),
    address: text('address').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('claim_address_once').on(table.claimId, table.role, table.chain, table.address),
  ],
);

/**
 * An extra transaction on a claim, beyond the main one the claim itself holds, on any chain. What the chain showed for it when
 * it was saved is kept with it.
 */
export const claimTransactionSchema = pgTable(
  'claim_transaction',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claimSchema.id),
    chain: text('chain').$type<ChainId>().notNull(),
    hash: text('hash').notNull(),
    check: jsonb('check').$type<StoredCheck>(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('claim_transaction_once').on(table.claimId, table.chain, table.hash)],
);

/**
 * What a person changed on a claim after sending it: each field with its value before and after, kept so an edit never erases
 * what was first said. Rows are only ever added.
 */
export const claimRevisionSchema = pgTable(
  'claim_revision',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claimSchema.id),
    /** The Clerk user id of the person who edited it. */
    userId: text('user_id').notNull(),
    changes: jsonb('changes')
      .$type<Record<string, { from: string | null; to: string | null }>>()
      .notNull(),
    /** The claim's state when it was edited, such as `accepted`; an edit sends it back for review. */
    stateBefore: text('state_before').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('claim_revision_by_claim').on(table.claimId, table.createdAt)],
);

const bytea = customType<{ data: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * A screenshot or receipt a person sent to show they control a wallet, kept as bytes so no other service holds it. Only the
 * person and staff can open it; it is never shown to counsel. It is deleted with the claim, and when staff decline it.
 */
export const claimProofSchema = pgTable(
  'claim_proof',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => claimSchema.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [index('claim_proof_claim_idx').on(table.claimId)],
);

/**
 * A case: the claims against one platform, pooled. The case bank shows the summary to everyone. The platform name here is
 * what Celia calls it until the platform consents to being named. `platformKey` matches the claims that belong to it, so the
 * number of claimants is counted, never stored.
 */
export const caseSchema = pgTable('case', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** The running number shown as `CB-0142`. */
  seq: serial('seq').notNull().unique(),
  name: text('name').notNull(),
  /** The same reduced name the claims carry in `claim.platform_key`. */
  platformKey: text('platform_key').notNull().unique(),
  /** One line on the case, such as the wallets affected and the estimated loss. Written when a report is saved. */
  description: text('description'),
  /** Who the claimants allege ran the platform: names, links and the countries they are linked to, as plain notes. Staff write it. It records what is alleged, not a finding. */
  /** The estimated loss to the platform in US dollars, from the newest report. It decides when a case starts building evidence. */
  estimatedLossUsd: bigint('estimated_loss_usd', { mode: 'number' }),
  operators: text('operators'),
  /** The jurisdiction ids the alleged operators are linked to, such as where a company is registered. Staff set them; they record what is alleged. */
  operatorJurisdictions: jsonb('operator_jurisdictions').$type<string[]>().notNull().default([]),
  /** `collecting` claims, `building` evidence or `sealed` (enough evidence). A case begins as `collecting`, moves to `building` by itself, and staff mark it `sealed`. */
  status: text('status').$type<CaseStatus>().notNull().default('collecting'),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/**
 * The lawyers working a case. For now a firm is its lead lawyer: one `lead` row per case, which the unique index below
 * enforces, so two firms cannot take the same case even at the same moment. `member` rows are for colleagues, added later.
 */
export const caseTeamSchema = pgTable(
  'case_team',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => caseSchema.id),
    /** The Clerk user id of the lawyer. */
    userId: text('user_id').notNull(),
    role: text('role').$type<'lead' | 'member'>().notNull(),
    /** When the lawyer confirmed their firm checked conflicts for this case. */
    conflictsConfirmedAt: timestamp('conflicts_confirmed_at', { mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [
    unique('case_team_one_row_per_lawyer').on(table.caseId, table.userId),
    uniqueIndex('case_team_one_lead')
      .on(table.caseId)
      .where(sql`${table.role} = 'lead'`),
  ],
);

/**
 * One thing that happened to one person, shown in their notifications inside the app. `data` holds ids and nothing else, so no
 * claim detail is copied here; the page reads the claim or case itself. `dedupeKey` makes a repeated action write one row.
 */
export const notificationSchema = pgTable(
  'notification',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** The Clerk user id of the person it is for. */
    userId: text('user_id').notNull(),
    type: text('type').$type<NotificationType>().notNull(),
    data: jsonb('data').$type<Record<string, string>>().notNull().default({}),
    dedupeKey: text('dedupe_key').notNull(),
    readAt: timestamp('read_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('notification_one_per_event').on(table.userId, table.dedupeKey),
    index('notification_by_user').on(table.userId, table.createdAt),
  ],
);

export type EmailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'suppressed' | 'cancelled';

/**
 * The outbox: one row per email to send. It is written in the same transaction as the event that caused it, so an email is
 * never lost and never sent for something that rolled back. A worker claims `pending` rows that are due. The address is not
 * stored: it is read from Clerk when the message is sent, so a changed address is respected.
 */
export const emailMessageSchema = pgTable(
  'email_message',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notificationSchema.id),
    userId: text('user_id').notNull(),
    type: text('type').$type<NotificationType>().notNull(),
    /** The person's language when the event happened, so the email is written in it. */
    locale: text('locale').notNull(),
    status: text('status').$type<EmailStatus>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Set while a worker holds the row, so a crashed worker's rows can be found and released. */
    lockedAt: timestamp('locked_at', { mode: 'date', withTimezone: true }),
    lastError: text('last_error'),
    /** The address the message went to, kept only once sent, for matching bounces. */
    sentTo: text('sent_to'),
    sentAt: timestamp('sent_at', { mode: 'date', withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('email_message_one_per_notification').on(table.notificationId),
    index('email_message_due').on(table.status, table.nextAttemptAt),
  ],
);

/** Addresses we must not mail: ones that bounced or complained. Checked before every send. */
export const emailSuppressionSchema = pgTable('email_suppression', {
  /** Lowercase. */
  email: text('email').primaryKey(),
  reason: text('reason').$type<'bounce' | 'complaint' | 'manual'>().notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
});

/** Settings that belong to a person but are not in Clerk. For now only the language their emails are written in. */
export const userSettingSchema = pgTable('user_setting', {
  userId: text('user_id').primaryKey(),
  locale: text('locale').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * The one-time identity check that stops spam: a person must pass it before they can report a loss. Only the result is kept, never
 * the document or the selfie. `attempts` caps how often someone can try.
 */
export const identityCheckSchema = pgTable('identity_check', {
  userId: text('user_id').primaryKey(),
  /** `verified` once Idswyft says so; anything else it returns, including a manual review, is `failed`. */
  status: text('status').$type<'verified' | 'failed'>().notNull(),
  verificationId: text('verification_id'),
  attempts: integer('attempts').default(1).notNull(),
  verifiedAt: timestamp('verified_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** Which optional categories of email a person has chosen. A missing row means on. Account notices ignore this. */
export const notificationPreferenceSchema = pgTable(
  'notification_preference',
  {
    userId: text('user_id').notNull(),
    category: text('category').$type<OptionalCategory>().notNull(),
    email: boolean('email').notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique('notification_preference_one_per_category').on(table.userId, table.category)],
);

/**
 * A copy of what Clerk holds about a lawyer that we need to search on: who is verified and where they are admitted. Clerk
 * metadata cannot be queried, so without this we could not find the lawyers a sealed case is ready for. Clerk stays the source
 * of truth; this is written next to every Clerk write.
 */
export const counselProfileSchema = pgTable('counsel_profile', {
  userId: text('user_id').primaryKey(),
  review: text('review').$type<'pending' | 'verified'>().notNull(),
  /** What kind of professional or institution it is. Only a law firm can take a case. */
  kind: text('kind').$type<InstitutionKind>().notNull().default('law_firm'),
  firm: text('firm'),
  jurisdictions: jsonb('jurisdictions').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * A professional or institution's application to join, kept with the review of it. Staff tick the checks against public
 * records, one person marks it ready and a different person approves it. The decision and its reason stay on record. Nothing
 * here is shown to other people.
 */
export const institutionApplicationSchema = pgTable('institution_application', {
  /** The Clerk user id of the person who applied. */
  userId: text('user_id').primaryKey(),
  kind: text('kind').$type<InstitutionKind>().notNull(),
  /** The firm or organisation; null for an independent lawyer. */
  organisation: text('organisation'),
  /** The company registration or bar number they gave. */
  registrationNumber: text('registration_number'),
  website: text('website'),
  /** Their role at the organisation. */
  contactRole: text('contact_role'),
  status: text('status').$type<ApplicationStatus>().notNull().default('in_review'),
  /** The checks staff have ticked, by name. */
  checks: jsonb('checks').$type<Partial<Record<ReviewCheck, boolean>>>().notNull().default({}),
  /** The staff member who marked it ready for approval. */
  readyBy: text('ready_by'),
  readyAt: timestamp('ready_at', { mode: 'date', withTimezone: true }),
  /** The staff member who approved or rejected it, and when. */
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at', { mode: 'date', withTimezone: true }),
  /** Why it was rejected. Shown to the applicant. */
  decisionNote: text('decision_note'),
  submittedAt: timestamp('submitted_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  /** When we aim to have decided by, shown to the applicant. */
  reviewDueAt: timestamp('review_due_at', { mode: 'date', withTimezone: true }).notNull(),
  /** What the registry and sanctions lookups found, when staff ran them. They inform the checks; staff still tick each one. */
  lookups: jsonb('lookups').$type<ApplicationLookups>(),
  lookedUpAt: timestamp('looked_up_at', { mode: 'date', withTimezone: true }),
});

/**
 * The findings of an analysis of a case, frozen as a record. A case may have several versions as the analysis is redone; the
 * newest is the one shown. `snapshot` is public-facts-only JSON checked by `ReportValidation`, and `hash` is its SHA-256, so
 * a changed snapshot no longer matches the hash shown with it.
 */
export const caseReportSchema = pgTable(
  'case_report',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => caseSchema.id),
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').$type<Report>().notNull(),
    hash: text('hash').notNull(),
    /** The staff member who saved it. */
    savedBy: text('saved_by').notNull(),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('case_report_one_per_version').on(table.caseId, table.version)],
);

/** What a member of staff did, as recorded in `staff_audit`. */
export type StaffAction =
  | 'counsel_verified'
  | 'ownership_confirmed'
  | 'ownership_declined'
  | 'claim_validated'
  | 'claim_review_started'
  | 'claim_rejected'
  | 'case_opened'
  | 'case_status_set'
  | 'case_operators_saved'
  | 'report_saved'
  | 'counsel_synced'
  | 'mail_retried'
  | 'mail_allowed'
  | 'application_checked'
  | 'application_lookup'
  | 'application_ready'
  | 'application_approved'
  | 'application_rejected'
  | 'sandworm_connected'
  | 'sandworm_disconnected'
  | 'sandworm_called';

/**
 * A staff member's sign-in to Sandworm, so Celia can call the Sandworm MCP as them. A refresh token is a full Sandworm login, so
 * both tokens are sealed with `SANDWORM_TOKEN_KEY` and never leave the server. One row per person; disconnecting deletes it.
 */
export const sandwormConnectionSchema = pgTable('sandworm_connection', {
  /** The Clerk user id of the staff member. */
  userId: text('user_id').primaryKey(),
  /** Sealed. Sandworm gives a new one with every refresh and each lives 7 days. */
  refreshToken: text('refresh_token').notNull(),
  /** Sealed. Kept so a call does not refresh every time; it lives 15 minutes. */
  accessToken: text('access_token'),
  accessExpiresAt: timestamp('access_expires_at', { mode: 'date', withTimezone: true }),
  connectedAt: timestamp('connected_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * The record of what staff did: who, what, to which thing and when. Rows are only ever added, never changed or removed by the
 * app, so it can answer "who confirmed this?" later. `details` holds ids and short codes, never a person's claim.
 */
export const staffAuditSchema = pgTable(
  'staff_audit',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** The Clerk user id of the staff member. */
    actorId: text('actor_id').notNull(),
    /** Their email at the time, so the record still reads if the account is later deleted. */
    actorEmail: text('actor_email'),
    action: text('action').$type<StaffAction>().notNull(),
    /** What it was done to, such as `claim`, `case`, `lawyer` or `email`. */
    targetType: text('target_type'),
    targetId: text('target_id'),
    details: jsonb('details').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('staff_audit_recent').on(table.createdAt)],
);

export type CaseEventType =
  | 'case_opened'
  | 'claim_added'
  | 'report_saved'
  | 'case_sealed'
  | 'case_taken';

/**
 * What happened to a case and when: it was opened, claims were added, a report was saved, the evidence was sealed, a firm took
 * it. The overview's activity feed and its "sealed this month" count read this. It holds no names and no claim detail, only the
 * case and the kind of event, so it is safe to show to any lawyer who can see the case.
 */
export const caseEventSchema = pgTable(
  'case_event',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => caseSchema.id),
    type: text('type').$type<CaseEventType>().notNull(),
    /** How many things the event covers, such as claims added at once. */
    count: integer('count').notNull().default(1),
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('case_event_recent').on(table.createdAt)],
);
