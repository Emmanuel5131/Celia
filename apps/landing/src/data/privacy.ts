import { legalEmail, type LegalDocument } from './legal';

export const privacy: LegalDocument = {
  path: '/privacy/',
  title: 'Privacy Policy',
  lead: 'Celia collects only the data needed to document crypto-fraud losses and pass verified evidence to the law firms you choose; we never sell your data.',
  updated: '31 October 2026',
  sections: [
    {
      title: 'Scope and our role',
      blocks: [
        {
          p: 'This Privacy Notice explains how [Celia, Inc.], a [Delaware] corporation headquartered at [street address], San Francisco, California [ZIP], United States (“Celia”, “we”, “us”), collects, uses and shares personal data through the Celia website, web app, claim forms and related services (the “Services”).',
        },
        {
          p: 'Celia helps victims of crypto fraud report what happened, gather on-chain and off-chain evidence, and pool their claims so that partner law firms, investigators and authorities can act on them.',
        },
        {
          ul: [
            '**Controller:** Celia decides why and how your data is processed for the Services, so Celia is the data controller.',
            '**Processor role:** where a partner law firm uses Celia to manage its own clients’ files, Celia acts as that firm’s processor, and the firm’s privacy notice governs that data.',
            '**Not covered:** third-party sites, wallets, exchanges or blockchain explorers we link to.',
          ],
        },
      ],
    },
    {
      title: 'Personal data we collect',
      blocks: [
        {
          p: 'We collect data you give us, data created when you use the Services, and data from public blockchains and partners.',
        },
        {
          table: {
            head: ['Category', 'Examples', 'Source'],
            rows: [
              ['Contact details', 'Name, email, phone number, country, preferred language', 'You'],
              [
                'Identity verification',
                'Government ID image, selfie, date of birth (only when a law firm or authority needs proof of identity)',
                'You, via [KYC provider]',
              ],
              [
                'Claim details',
                'What happened, dates, amounts lost, platforms or people involved, your written statement',
                'You',
              ],
              [
                'Wallet and transaction data',
                'Wallet addresses, transaction hashes, exchange account references, amounts and tokens',
                'You and public blockchains',
              ],
              [
                'Evidence files',
                'Screenshots, chat logs, emails, bank or exchange statements, receipts',
                'You',
              ],
              [
                'Third-party data',
                'Names, usernames, phone numbers, websites or wallets of suspected scammers; details of witnesses',
                'You and public sources',
              ],
              [
                'Account and login data',
                'Username, password hash, sign-in times, two-factor settings',
                'You and the Services',
              ],
              [
                'Device and log data',
                'IP address, browser, operating system, pages visited, error logs',
                'Collected automatically',
              ],
              [
                'Communications',
                'Messages with our support team or with partner law firms through Celia',
                'You and partners',
              ],
              ['Cookie data', 'See section 6', 'Collected automatically'],
            ],
          },
        },
        {
          p: 'We do not ask for your private keys, seed phrases or exchange passwords, and you should never send them to us. Anyone asking for them in Celia’s name is a scammer.',
        },
        {
          p: 'Claim details can reveal sensitive information, such as your financial situation or health effects of the fraud. We process it only with your explicit consent or where the law allows.',
        },
      ],
    },
    {
      title: 'How we use personal data, and our legal basis',
      blocks: [
        {
          p: 'We use personal data only for the purposes below. For users in the EEA and UK, the right-hand column gives our legal basis under Article 6 of the GDPR.',
        },
        {
          table: {
            head: ['Purpose', 'Legal basis (EEA/UK users)'],
            rows: [
              ['Create and run your account; receive and store your claim', 'Contract'],
              [
                'Trace funds and link your wallet and transaction data to on-chain evidence',
                'Contract; legitimate interest in building accurate evidence',
              ],
              [
                'Group similar claims into pooled cases (for example, same scam wallet or website)',
                'Consent',
              ],
              ['Share your claim file with a law firm, investigator or authority you approve', 'Consent'],
              ['Verify your identity before a claim is shared', 'Contract; legal obligation'],
              ['Process sensitive details in your statement', 'Explicit consent'],
              [
                'Record information about suspected scammers to support your claim and warn other victims',
                'Legitimate interest in preventing and pursuing fraud',
              ],
              ['Keep the Services secure and stop fake or abusive claims', 'Legitimate interest'],
              ['Send service messages (case updates, security alerts)', 'Contract'],
              ['Send news or product updates', 'Consent (you can unsubscribe any time)'],
              [
                'Produce anonymous statistics on fraud trends',
                'Legitimate interest (data is aggregated first)',
              ],
              ['Respond to court orders and meet legal duties', 'Legal obligation'],
            ],
          },
        },
        {
          p: 'We may use automated tools to flag matching wallets or patterns across claims. A person reviews any result before it affects your claim, and we do not make fully automated decisions with legal effects on you.',
        },
      ],
    },
    {
      title: 'How we share personal data',
      blocks: [
        {
          p: 'We share your claim file only with recipients you approve, plus the service providers and authorities listed below. We never sell personal data.',
        },
        {
          ul: [
            '**Partner law firms and investigators you approve.** Before sharing, we show you who will receive your file and what it contains. Each partner signs a data-sharing agreement requiring confidentiality and use only for your case.',
            '**Other victims in a pooled case.** They see only anonymised facts (for example, the scam wallet and total losses), never your name or contact details, unless you agree otherwise.',
            '**Law enforcement and regulators.** We share data when you ask us to report a crime, or when we must respond to a court order, subpoena or other lawful request. We review each request and disclose only what is required.',
            '**Exchanges and virtual asset service providers.** With your consent, we send wallet and transaction details to help them freeze or trace funds.',
            '**Business transfers.** If Celia merges, is acquired or sells assets, your data may transfer to the new owner under this Notice. We will tell you before that happens.',
            '**Others at your direction.** Anyone else you ask us to share with.',
          ],
        },
      ],
    },
    {
      title: 'Blockchain data',
      blocks: [
        {
          p: 'Public blockchains are open ledgers that no one, including Celia, can edit or delete. When you link a wallet address to your claim, that link becomes personal data that we protect under this Notice. We never write your personal data onto a blockchain. If we anchor evidence on-chain to prove it has not been altered, we record only a cryptographic hash, which cannot identify you.',
        },
      ],
    },
    {
      title: 'Cookies and similar technologies',
      blocks: [
        {
          p: 'We use essential cookies to keep you signed in and secure. With your consent, we also use analytics cookies to understand how the Services are used. You can change your choice at any time in [Cookie settings]. We do not use advertising or cross-site tracking cookies. We treat a Global Privacy Control (GPC) signal from your browser as a valid opt-out request. As there is no agreed standard for browser “Do Not Track” signals, the Services do not respond to them.',
        },
      ],
    },
    {
      title: 'How long we keep data',
      blocks: [
        {
          table: {
            head: ['Data', 'Kept for'],
            rows: [
              [
                'Account and claim data',
                'While your account is open, then [6] years after your claim closes to support legal proceedings',
              ],
              [
                'Identity verification files',
                '[12] months after verification, unless a case needs them longer',
              ],
              ['Evidence shared with a law firm', 'Per that firm’s retention policy once shared'],
              ['Log and security data', '[12] months'],
              ['Marketing preferences', 'Until you unsubscribe'],
            ],
          },
        },
        {
          p: 'After these periods we delete or anonymise the data, unless the law requires us to keep it longer.',
        },
      ],
    },
    {
      title: 'International transfers',
      blocks: [
        {
          p: 'Celia is based in the United States, and we store and process data mainly in the US. If you use the Services from another country, your data will be transferred to the US, where privacy laws may differ from yours. For data from the EEA, UK or Switzerland, we rely on the EU-U.S. Data Privacy Framework (and its UK and Swiss extensions) where we are certified, or on standard contractual clauses.',
        },
      ],
    },
    {
      title: 'Your privacy rights',
      blocks: [
        { p: 'Depending on where you live, you can ask us to:' },
        {
          ul: [
            'access a copy of your data;',
            'correct inaccurate data;',
            'delete your data, where we have no legal reason to keep it;',
            'restrict or object to processing, including processing based on legitimate interest;',
            'move your data to another service (portability);',
            'withdraw consent at any time (this does not affect earlier processing);',
            'have a person review any automated decision.',
          ],
        },
        {
          p: `Write to ${legalEmail}. We may ask you to verify your identity first. We reply within 45 days, or within one month for EEA and UK users. EEA and UK users can also complain to their local data protection authority. California residents have the additional rights set out in section 10.`,
        },
      ],
    },
    {
      title: 'California privacy rights',
      blocks: [
        {
          p: 'This section applies to California residents and supplements the rest of this Notice. It also serves as our notice at collection under the CCPA.',
        },
        {
          p: '**Categories of personal information.** In the past 12 months we have collected the categories below and disclosed them for business purposes only.',
        },
        {
          table: {
            head: ['CCPA category', 'Examples', 'Disclosed for a business purpose to'],
            rows: [
              [
                'Identifiers',
                'Name, email, phone, IP address, account username, wallet addresses',
                'Service providers; law firms, investigators and authorities you approve',
              ],
              [
                'Customer records (Cal. Civ. Code § 1798.80(e))',
                'ID images, financial details of your loss',
                'Service providers; recipients you approve',
              ],
              [
                'Commercial information',
                'Transactions, amounts and tokens lost',
                'Service providers; recipients you approve',
              ],
              [
                'Internet or network activity',
                'Log, device and cookie data',
                'Service providers',
              ],
              [
                'Audio, electronic or visual information',
                'Selfies, screenshots, chat logs',
                'Identity verification provider; recipients you approve',
              ],
              [
                'Sensitive personal information',
                'Government ID numbers, account login credentials',
                'Identity verification provider; recipients you approve',
              ],
            ],
          },
        },
        {
          p: 'We collect this information from the sources and for the purposes in sections 2 and 3, and keep it for the periods in section 7.',
        },
        {
          p: '**No sale or sharing.** We do not sell personal information or share it for cross-context behavioral advertising. We do not knowingly sell or share the personal information of consumers under 16.',
        },
        {
          p: '**Sensitive personal information.** We use it only for purposes the CCPA permits without a right to limit, such as verifying identity and providing the Services you request.',
        },
        { p: '**Your rights.** You can:' },
        {
          ul: [
            'know what personal information we collect, use and disclose, and get a copy;',
            'delete personal information we hold about you, subject to legal exceptions;',
            'correct inaccurate personal information;',
            'opt out of sale or sharing (we do neither, but GPC signals are honoured);',
            'not be discriminated against for using any of these rights.',
          ],
        },
        {
          p: `**How to make a request.** Email ${legalEmail}. We verify requests by matching details you give us with what we hold. You can use an authorized agent with your signed permission; we may still ask you to confirm your identity. We confirm receipt within 10 business days and respond within 45 days, or tell you if we need up to 45 more.`,
        },
        {
          p: '**Shine the Light.** We do not disclose personal information to third parties for their own direct marketing (Cal. Civ. Code § 1798.83).',
        },
        {
          p: '**Complaints.** You can also contact the California Privacy Protection Agency.',
        },
      ],
    },
    {
      title: 'Security',
      blocks: [
        {
          p: 'We encrypt data in transit and at rest, limit staff access to those who need it, require two-factor sign-in for staff, and log access to claim files. No system is fully secure. If a breach affects your personal information, we will notify you and any required regulators as the law requires, including under California Civil Code section 1798.82 and, for EEA and UK users, within 72 hours under the GDPR.',
        },
      ],
    },
    {
      title: 'Children’s privacy',
      blocks: [
        {
          p: `In line with the Children’s Online Privacy Protection Act (COPPA) and the CCPA, you must be 18 or older to open a Celia account. We do not knowingly collect personal information directly from children under 13, and we do not sell or share the personal information of anyone under 16. If we learn that a child has given us personal information without the consent described below, we will delete it promptly. If you believe this has happened, contact us at ${legalEmail}.`,
        },
        {
          p: '**Claims for children who have been defrauded.** Children are not excluded from Celia’s protection. A parent or legal guardian may file a claim for a child under 18, as follows:',
        },
        {
          ul: [
            '**Guardian account.** The parent or guardian opens the account, accepts our terms and acts for the child throughout the claim.',
            '**Proof of guardianship.** We ask for a document showing the relationship, such as a birth certificate or court guardianship order.',
            '**Consent.** The parent or guardian gives consent before we collect the child’s information. For children under 13, this serves as verifiable parental consent under COPPA.',
            '**Minimal data.** We collect only what the claim needs about the child, such as name, age, wallet and transaction details and evidence. We do not ask the child for identity documents or photos.',
            '**Limited sharing.** We share the child’s information only with the law firms, investigators or authorities the parent or guardian approves.',
            '**Parental control.** The parent or guardian can review, correct or delete the child’s information, or withdraw consent, at any time by contacting us.',
          ],
        },
      ],
    },
    {
      title: 'Changes to this Notice',
      blocks: [
        {
          p: 'We will post updates here and change the “last updated” date. For material changes, we will notify you by email or in the app before they take effect.',
        },
      ],
    },
    {
      title: 'Contact us',
      blocks: [
        { p: `Celia, Inc.\nSan Francisco, CA, United States\nEmail: ${legalEmail}` },
        {
          p: '**Scam warning:** Celia will never ask for your private keys or seed phrase, charge an upfront “recovery fee”, or contact you first promising to recover funds.',
        },
      ],
    },
  ],
};
