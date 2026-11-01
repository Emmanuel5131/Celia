import { randomBytes } from 'node:crypto';
import { platformKey } from '@celia/core';
import { and, eq, inArray, like } from 'drizzle-orm';
import { addConfirmedClaim } from '@/libs/cases/Cases';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  caseActionSchema,
  caseEvidenceSchema,
  caseSchema,
  caseStatementSchema,
  claimAddressSchema,
  claimSchema,
} from '@/models/Schema';
import { money, victimCountries } from './claims';
import { int, logNormal, pick, weighted } from './random';

/**
 * Four cases on real, public events, for a demo: the Binance hot wallet exploit (October 2026), the Bybit theft (February 2025),
 * the Ronin bridge theft (March 2022) and Forsage. The platforms, addresses, transactions and sources are real and public; the
 * claimants are synthetic (`seed_user_real_*`), because nobody's real claim belongs in a demo. Every action is worded as what
 * public reports say, never as a finding of fraud. Each entry names where the money went.
 *
 * The facts come from public reporting and analytics write-ups, and have not been checked on a block explorer. Check an item
 * before relying on it.
 *
 * Run: `pnpm exec dotenv -c -- tsx scripts/seed/real-cases.ts [--live] [--only "Case name"]`. A shared database needs `--live`. Safe to run again.
 */
type Item = { kind?: string; title: string; note: string; on?: string };
type Proof = {
  type: 'link' | 'wallet' | 'transaction';
  title: string;
  note: string;
  url?: string;
  chain?: 'ethereum';
  reference?: string;
};
type RealCase = {
  name: string;
  fraudType: 'wallet_drained' | 'investment_platform';
  firstOn: string;
  lastOn: string;
  asset: string;
  receiving?: string;
  claimants: number;
  actions: Item[];
  proofs: Proof[];
  statements?: { kind: 'withdrawals' | 'other'; text: string; url: string; on?: string }[];
};

const SEC_COMPLAINT = 'https://www.sec.gov/files/litigation/complaints/2022/comp-pr2022-134.pdf';

const cases: RealCase[] = [
  {
    name: 'Binance hot wallet exploit',
    fraudType: 'wallet_drained',
    firstOn: '2026-10-29',
    lastOn: '2026-10-29',
    asset: 'ETH, USDT, USDC',
    receiving: '0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c',
    claimants: 48,
    actions: [
      {
        kind: 'Funds moved',
        title: 'Reports say Binance hot wallets were drained on 29 October 2026',
        note: 'Analytics reports describe a drain of hot wallets on several chains, starting about 20:20 UTC. Binance’s own estimate is reported as about $6.3 billion; other sources give different totals, from $2.8 billion to $6.4 billion.',
        on: '2026-10-29',
      },
      {
        kind: 'Funds moved',
        title: 'Reports say funds left the Binance 14 wallet for a new receiving address',
        note: 'The Ethereum hot wallet labeled Binance 14 is reported to have run code set by the attacker, and the funds to have gone to 0x5227…2f8c.',
        on: '2026-10-29',
      },
      {
        kind: 'Funds moved',
        title: 'Reports say the Ethereum was split across several stash wallets',
        note: 'One write-up lists the largest ETH stash at 0x8532…43d4 (197,460 ETH on 31 October) and others holding between 7,000 and 138,000 ETH.',
        on: '2026-10-31',
      },
      {
        kind: 'Funds moved',
        title: 'Reports say part of the ETH was swapped through THORChain',
        note: 'About 3,600 ETH is reported to have gone to new wallets through THORChain payees. One write-up also reports sales of smaller tokens and bridging.',
        on: '2026-10-31',
      },
      {
        kind: 'Funds frozen',
        title: 'Tether and Circle are reported to have frozen stablecoins at the receiving address',
        note: 'Reports put the frozen USDT and USDC at roughly 975 million and 823 million. The amounts differ between sources.',
        on: '2026-10-30',
      },
    ],
    proofs: [
      {
        type: 'wallet',
        title: 'Affected wallet: Binance 14 (Ethereum)',
        note: 'The Binance hot wallet reported as drained.',
        chain: 'ethereum',
        reference: '0x28c6c06298d514db089934071355e5743bf21d60',
      },
      {
        type: 'wallet',
        title: 'Main receiving address (Ethereum)',
        note: 'Reported to hold frozen USDT and USDC.',
        chain: 'ethereum',
        reference: '0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c',
      },
      {
        type: 'wallet',
        title: 'Gas wallet funded through Tornado Cash',
        note: 'Reported to have paid the fees for the drain, funded by Tornado Cash.',
        chain: 'ethereum',
        reference: '0xe4f9070e1316de2988fc6f869fead8fb99cc74cd',
      },
      {
        type: 'transaction',
        title: 'Main drain (29 October, 20:24 UTC)',
        note: 'The transaction reported as the main Ethereum drain.',
        chain: 'ethereum',
        reference: '0x53bd38b816c23e74134786c29a8c18d792777998a3b9326047b583100e88e2f3',
      },
      {
        type: 'transaction',
        title: 'Setup with 50 approvals (20:20 UTC)',
        note: 'The transaction reported as the setup before the drain.',
        chain: 'ethereum',
        reference: '0xad99264d5532ae0dd04b2004eebda05f25657e70dacb764f7ac8d4ccd051298b',
      },
      {
        type: 'link',
        title: 'Bitquery investigation',
        note: 'Wallets, transactions and a timeline across chains.',
        url: 'https://www.bitquery.io/investigations/binance-hack',
      },
      {
        type: 'link',
        title: 'Chainalysis findings',
        note: 'Attributes the attack to a North Korean group on the basis of on-chain analysis. It is an attribution by one firm, not a court finding.',
        url: 'https://www.chainalysis.com/blog/binance-exploit-latest-findings-and-response/',
      },
      {
        type: 'link',
        title: 'Fireblocks: how the exploit worked',
        note: 'Describes an EIP-7702 delegation of the hot wallet.',
        url: 'https://www.fireblocks.com/blog/binance-hack-eip-7702',
      },
    ],
  },
  {
    name: 'Bybit cold wallet theft',
    fraudType: 'wallet_drained',
    firstOn: '2025-02-21',
    lastOn: '2025-02-21',
    asset: 'ETH and staked ETH',
    claimants: 30,
    actions: [
      {
        kind: 'Funds moved',
        title:
          'Reports say about $1.4 to $1.5 billion left a Bybit Ethereum cold wallet on 21 February 2025',
        note: 'Reporting puts about 499,000 ETH among the stolen assets. Figures differ between sources.',
        on: '2025-02-21',
      },
      {
        kind: 'Attribution',
        title:
          'The FBI said North Korean actors (TraderTraitor, also called Lazarus) were behind it',
        note: 'The FBI’s statement of 26 February 2025 also listed 51 Ethereum addresses it linked to the theft. It is an agency attribution, not a court finding.',
        on: '2025-02-26',
      },
      {
        kind: 'Funds moved',
        title:
          'Reports say the funds went first to distribution addresses, then to dozens of new addresses',
        note: 'Analytics reports describe three distribution addresses, then many newly created ones.',
        on: '2025-02-21',
      },
      {
        kind: 'Funds moved',
        title: 'Reports say more than half of the ETH was swapped for Bitcoin through THORChain',
        note: 'By early March one analyst counted about 343,000 of the 499,000 ETH as moved. The tallies were revised as laundering went on.',
        on: '2025-03-01',
      },
    ],
    proofs: [
      {
        type: 'wallet',
        title: 'Affected wallet: Bybit Ethereum cold wallet',
        note: 'The wallet that lost the funds, according to several reports.',
        chain: 'ethereum',
        reference: '0x1Db92e2EeBC8E0c075a02BeA49a2935BcD2dFCF4',
      },
      {
        type: 'transaction',
        title: 'Main drain (21 February 2025)',
        note: 'Reported to have moved about 401,000 ETH out of the cold wallet. Two write-ups give the same hash.',
        chain: 'ethereum',
        reference: '0xb61413c495fdad6114a7aa863a00b2e3c28945979a10885b12b30316ea9f072c',
      },
      {
        type: 'wallet',
        title: 'Address reported as the exploiter',
        note: 'Named by one source. Another source lists a different sending address, so check it before relying on it.',
        chain: 'ethereum',
        reference: '0x47666Fab8bD0Ac7003bce3f5C3585383F09486E2',
      },
      {
        type: 'link',
        title: 'The Block: ETH moved to Bitcoin through THORChain',
        note: 'Reports the FBI confirmation and the swaps.',
        url: 'https://www.theblock.co/post/343855/bybit-hackers-half-the-stolen-eth-bitcoin-fbi-confirms-lazarus',
      },
      {
        type: 'link',
        title: 'Cointelegraph: Lazarus launders $605M of ETH',
        note: 'Reports an analytics tally of the laundering and the response of THORChain validators.',
        url: 'https://cointelegraph.com/news/bybit-hack-lazarus-launders-605m-eth',
      },
    ],
  },
  {
    name: 'Ronin bridge theft',
    fraudType: 'wallet_drained',
    firstOn: '2022-03-23',
    lastOn: '2022-03-23',
    asset: 'ETH, USDC',
    receiving: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
    claimants: 64,
    actions: [
      {
        kind: 'Funds moved',
        title: 'Reports say more than $600 million left the Ronin bridge in March 2022',
        note: 'Reports give figures from $540 million to over $615 million, depending on the date and prices used.',
        on: '2022-03-23',
      },
      {
        kind: 'Funds moved',
        title: 'Reports say about 173,600 ETH and 25.5 million USDC were taken in two transactions',
        note: 'Sky Mavis said the attacker used hacked validator keys to forge withdrawals. Five of the nine validators’ signatures were reportedly obtained. The theft was found days later, after a user could not withdraw 5,000 ETH.',
        on: '2022-03-23',
      },
      {
        kind: 'Funds moved',
        title:
          'Reports say the USDC was moved on at once and a small part of the ETH went to exchanges',
        note: 'Early reports say all 25.5 million USDC was sent to other wallets and DeFi protocols, and 6,250 ETH was moved out, including some to an exchange.',
        on: '2022-03-29',
      },
      {
        kind: 'Attribution',
        title: 'The FBI and the US Treasury linked the theft to the Lazarus group',
        note: 'On 14 April 2022 the Treasury’s sanctions office added the attacker’s Ethereum address to its entry for the Lazarus group. It is an agency attribution, not a court finding.',
        on: '2022-04-14',
      },
      {
        kind: 'Funds moved',
        title: 'Reports say a large part of the ETH was sent through Tornado Cash',
        note: 'One analytics write-up reports 59,100 ETH sent in 591 transactions in April 2022. The figure comes from a single write-up and is approximate.',
        on: '2022-04-01',
      },
    ],
    proofs: [
      {
        type: 'wallet',
        title: 'Attacker address listed by the US sanctions office (Ethereum)',
        note: 'The address the Treasury added on 14 April 2022.',
        chain: 'ethereum',
        reference: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96',
      },
      {
        type: 'link',
        title: 'Elliptic: Lazarus identified behind the Ronin bridge theft',
        note: 'Analysis of the theft and the addresses.',
        url: 'https://www.elliptic.co/blog/analysis/north-korea-s-lazarus-group-identified-as-exploiters-behind-540-million-ronin-bridge-theft',
      },
      {
        type: 'link',
        title: 'BleepingComputer: FBI links the theft to Lazarus',
        note: 'Reports the FBI statement.',
        url: 'https://www.bleepingcomputer.com/news/security/fbi-links-largest-crypto-hack-ever-to-north-korean-hackers',
      },
    ],
  },
  {
    name: 'Forsage SmartWay',
    fraudType: 'investment_platform',
    firstOn: '2020-01-20',
    lastOn: '2020-01-21',
    asset: 'ETH',
    receiving: '0xbfdbD665A11c60B6465Ec687e23241fC74bfC2fa',
    claimants: 90,
    actions: [
      {
        kind: 'Public statement',
        title: 'The SEC alleges Forsage was a pyramid and Ponzi scheme',
        note: 'The SEC’s complaint in SEC v. Okhotnikov et al. (N.D. Ill., 1:22-cv-03978), filed in August 2022, makes the allegation. It is the SEC’s allegation, not a finding by the court.',
        on: '2022-08-01',
      },
      {
        kind: 'Funds moved',
        title: 'Deposits went to the SmartWay Forsage contract on Ethereum',
        note: 'The contract was deployed on 20 January 2020. Participants’ payments were sent to it and passed on by its code to other participants.',
        on: '2020-01-20',
      },
    ],
    proofs: [
      {
        type: 'wallet',
        title: 'SmartWay Forsage contract (Ethereum)',
        note: 'The early Forsage contract named in public records.',
        chain: 'ethereum',
        reference: '0xbfdbD665A11c60B6465Ec687e23241fC74bfC2fa',
      },
      {
        type: 'link',
        title: 'SEC complaint',
        note: 'SEC v. Okhotnikov et al., Document 1.',
        url: SEC_COMPLAINT,
      },
    ],
    statements: [
      {
        kind: 'withdrawals',
        text: 'A Forsage founder said in a video, as quoted in the SEC complaint: "Here everyone decides for themselves when to withdraw, hold, no hold, and so on."',
        url: SEC_COMPLAINT,
      },
      {
        kind: 'other',
        text: 'A Forsage founder said in an interview, as quoted in the SEC complaint: "Forsage does not accumulate funds; its balance is always zero."',
        url: SEC_COMPLAINT,
        on: '2021-02-27',
      },
    ],
  },
];

const local = ['127.0.0.1', 'localhost', '::1'].includes(new URL(Env.DATABASE_URL).hostname);

if (!local && !process.argv.includes('--live')) {
  throw new Error('This only runs against a local database. Pass --live to seed a shared one.');
}

const day = 86_400_000;

type Route = {
  chain: 'ethereum' | 'tron' | 'bitcoin' | 'solana';
  assets: string[];
  receiving?: string;
};

/** Where each case's claimants lost money. Binance's drain hit several chains, so its claimants are spread across them. */
const routes: Record<string, [Route, number][]> = {
  'Binance hot wallet exploit': [
    [
      {
        chain: 'ethereum',
        assets: ['ETH', 'USDT', 'USDC'],
        receiving: '0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c',
      },
      55,
    ],
    [
      {
        chain: 'tron',
        assets: ['USDT (TRC20)', 'TRX'],
        receiving: 'TG5iBMQPrDzJJAUM8GMVBf1hRaJ1wvzsGi',
      },
      20,
    ],
    [
      {
        chain: 'bitcoin',
        assets: ['BTC'],
        receiving: 'bc1q0mtc2f5agpkvlq6hhahmfr3hlr55kyfjhl2mnm',
      },
      10,
    ],
    [
      {
        chain: 'solana',
        assets: ['SOL'],
        receiving: 'AffzFDKZbyMiU11zmVBoAqD25ugpr7xoWWyRyGigBEaU',
      },
      15,
    ],
  ],
};

/** The middle of the amounts claimants name in each case, in US dollars. Real losses spread widely, a few far above the middle. */
const medianLoss: Record<string, number> = {
  'Binance hot wallet exploit': 3500,
  'Bybit cold wallet theft': 4200,
  'Ronin bridge theft': 2600,
  'Forsage SmartWay': 650,
};

/** How many days after the first date a claim's last payment can fall, so the dates are not all the same. */
const spreadDays: Record<string, number> = { 'Ronin bridge theft': 2, 'Forsage SmartWay': 30 };

const walletKinds = [
  'metamask',
  'trust_wallet',
  'phantom',
  'coinbase_wallet',
  'ledger',
  'rabby',
  'exodus',
  'other',
] as const;

// `--only "Forsage SmartWay"` seeds one case, to finish a run that a dropped connection cut short.
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex === -1 ? undefined : process.argv[onlyIndex + 1];

for (const real of cases.filter((item) => only === undefined || item.name === only)) {
  const key = platformKey(real.name);
  const slug = key ?? 'case';

  if (!key) {
    throw new Error(`No key for ${real.name}.`);
  }

  const prefix = `seed_user_real_${slug.replaceAll('-', '_')}_`;
  // Start clean, so running it again gives the same claims.
  const old = await db
    .select({ id: claimSchema.id })
    .from(claimSchema)
    .where(like(claimSchema.userId, `${prefix.replaceAll('_', '\\_')}%`));

  if (old.length > 0) {
    const ids = old.map((row) => row.id);
    await db.delete(claimAddressSchema).where(inArray(claimAddressSchema.claimId, ids));
    await db.delete(claimSchema).where(inArray(claimSchema.id, ids));
  }

  // Built in memory and saved in two statements, so a slow or dropped connection cannot stop the run half way through a case.
  const rows: (typeof claimSchema.$inferInsert)[] = [];
  const receivers: ({ chain: Route['chain']; address: string } | null)[] = [];

  for (let index = 0; index < real.claimants; index += 1) {
    const route = pick(
      (
        routes[real.name] ?? [
          [{ chain: 'ethereum', assets: [real.asset], receiving: real.receiving }, 1],
        ]
      )
        .map(([item, weight]) => [item, weight] as [Route, number])
        .flatMap(([item, weight]) => Array.from({ length: weight }, () => item)),
    );
    const sentAt = new Date(Date.now() - int(1, 12) * day - int(0, 20) * 3_600_000);
    // Most sent claims are already accepted; the rest wait for staff, so a demo has a queue to work through.
    const accepted = int(1, 10) <= 7;
    const firstOn = new Date(
      Date.parse(`${real.firstOn}T00:00:00Z`) + int(0, spreadDays[real.name] ?? 0) * day,
    );
    const lastOn = new Date(firstOn.getTime() + int(0, spreadDays[real.name] ?? 0) * day);
    const fraudTypes: (typeof real.fraudType | 'account_takeover')[] =
      real.fraudType === 'wallet_drained' && int(1, 10) === 1
        ? ['wallet_drained', 'account_takeover']
        : [real.fraudType];

    rows.push({
      userId: `${prefix}${String(index + 1).padStart(3, '0')}`,
      fraudType: real.fraudType,
      fraudTypes,
      paymentMethod: int(1, 10) <= 8 ? 'wallet' : 'exchange',
      chain: route.chain,
      walletApp: pick([...walletKinds]),
      platformName: real.name,
      platformKey: key,
      destinationAddress: route.receiving,
      firstPaymentOn: firstOn.toISOString().slice(0, 10),
      lastPaymentOn: lastOn.toISOString().slice(0, 10),
      assetSent: pick(route.assets),
      amountLost: money(
        Math.max(50, Math.round(logNormal(medianLoss[real.name] ?? 1000, 0.9) / 10) * 10),
      ),
      statement: 'Seeded test claim. Not a real person.',
      country: weighted(victimCountries),
      nonce: randomBytes(16).toString('hex'),
      status: 'submitted',
      consentedAt: sentAt,
      submittedAt: sentAt,
      validatedAt: accepted ? sentAt : null,
      staffReviewStartedAt: accepted ? sentAt : null,
    });
    receivers.push(route.receiving ? { chain: route.chain, address: route.receiving } : null);
  }

  const saved = await db.insert(claimSchema).values(rows).returning({ id: claimSchema.id });
  const addresses = saved.flatMap((claim, index) => {
    const receiver = receivers[index];

    return receiver ? [{ claimId: claim.id, role: 'receiving' as const, ...receiver }] : [];
  });

  if (addresses.length > 0) {
    await db.insert(claimAddressSchema).values(addresses);
  }

  if (rows.some((row) => row.validatedAt)) {
    await addConfirmedClaim(db, { platformKey: key, platformName: real.name });
  }

  const [opened] = await db
    .select({ id: caseSchema.id, number: caseSchema.seq })
    .from(caseSchema)
    .where(and(eq(caseSchema.platformKey, key)));

  if (!opened) {
    throw new Error(`The case ${real.name} was not opened.`);
  }

  const held = await db
    .select({ id: caseActionSchema.id })
    .from(caseActionSchema)
    .where(eq(caseActionSchema.caseId, opened.id));

  if (held.length === 0) {
    await db.insert(caseActionSchema).values(
      real.actions.map((item) => ({
        caseId: opened.id,
        kind: item.kind ?? null,
        title: item.title,
        note: item.note,
        occurredOn: item.on ?? null,
        createdBy: 'seed_script',
      })),
    );
    await db.insert(caseEvidenceSchema).values(
      real.proofs.map((proof) => ({
        caseId: opened.id,
        type: proof.type,
        title: proof.title,
        note: proof.note,
        sourceUrl: proof.url ?? null,
        chain: proof.chain ?? null,
        reference: proof.reference ?? null,
        createdBy: 'seed_script',
      })),
    );

    if (real.statements) {
      await db.insert(caseStatementSchema).values(
        real.statements.map((statement) => ({
          caseId: opened.id,
          kind: statement.kind,
          text: statement.text,
          sourceUrl: statement.url,
          saidOn: statement.on ?? null,
          createdBy: 'seed_script',
        })),
      );
    }
  }

  console.log(`${real.name}: CB-${String(opened.number).padStart(4, '0')} (${opened.id})`);
}

process.exit(0);
