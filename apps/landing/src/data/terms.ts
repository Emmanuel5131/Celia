import { legalEmail, type LegalDocument } from './legal';

export const terms: LegalDocument = {
  path: '/terms/',
  title: 'Terms of Service',
  lead: 'These Terms govern your use of Celia; Celia organises your evidence and connects you with lawyers, but it is not a law firm and cannot guarantee you will recover any funds.',
  updated: '31 October 2026',
  sections: [
    {
      title: 'Agreement to these Terms',
      blocks: [
        {
          p: 'These Terms of Service (“Terms”) are a legal agreement between you and [Celia, Inc.], a [Delaware] corporation based in San Francisco, California (“Celia”, “we”, “us”). They govern your use of the Celia website, web app, claim forms and related services (the “Services”).',
        },
        {
          p: 'By creating an account or using the Services, you agree to these Terms and confirm you have read our Privacy Notice, which explains how we handle personal information. If you do not agree, do not use the Services.',
        },
      ],
    },
    {
      title: 'Eligibility',
      blocks: [
        {
          ul: [
            'You must be at least 18 and able to form a binding contract to open an account.',
            '**Claims for children.** A parent or legal guardian may open an account and file a claim for a child under 18 who has been defrauded, as set out in section 12 of our Privacy Notice. The parent or guardian accepts these Terms for themselves and on the child’s behalf and is responsible for the account.',
            '**Acting for someone else.** If you file a claim for another adult, a business or an estate, you confirm you have legal authority to do so and can show proof if asked.',
            'You may not use the Services if US law bars you from doing so, including if you are on a US government sanctions list.',
          ],
        },
      ],
    },
    {
      title: 'What Celia does and does not do',
      blocks: [
        {
          p: 'Celia helps victims of crypto fraud record what happened, gather on-chain and off-chain evidence, group similar claims into pooled cases, and share claim files with law firms, investigators and authorities they approve.',
        },
        {
          p: '**Celia is not a law firm and does not give legal advice.** Using Celia does not create an attorney-client relationship between you and Celia. Information on the Services is general information, not advice about your situation. If a partner law firm agrees to take your case, your relationship with that firm is set by a separate engagement agreement between you and the firm.',
        },
        {
          p: '**Celia does not guarantee recovery.** We do not promise that any law firm will take your case, that any funds will be traced, frozen or returned, or that any person will be prosecuted.',
        },
        {
          p: `**Celia is not a fund-recovery service.** We never ask for private keys or seed phrases, never charge an upfront “recovery fee”, and never contact victims first promising to recover funds. Anyone doing so in Celia’s name is a scammer; report them to ${legalEmail}.`,
        },
      ],
    },
    {
      title: 'Your account',
      blocks: [
        {
          ul: [
            'Give accurate information and keep it up to date.',
            'Keep your password safe. You are responsible for activity on your account.',
            `Tell us at once at ${legalEmail} if you think someone has accessed your account without permission.`,
            'One person may hold one account, except a parent or guardian, who may manage claims for more than one child.',
          ],
        },
      ],
    },
    {
      title: 'Your claims and evidence',
      blocks: [
        {
          p: '**Truthfulness.** You confirm that everything you submit is true and complete to the best of your knowledge. Filing a false or exaggerated claim can harm other victims and may be a crime. We may refuse, remove or report any claim we reasonably believe is false.',
        },
        {
          p: '**Your rights in what you submit.** You keep ownership of your statements, screenshots, documents and other content (“Your Content”). You confirm you have the right to submit it, and that it does not break anyone’s rights or the law.',
        },
        {
          p: '**Licence to Celia.** You give Celia a non-exclusive, worldwide, royalty-free licence to host, store, copy, analyse and organise Your Content, and to share it with the recipients you approve, only as needed to provide the Services. You can end this licence by deleting Your Content or closing your account, except for copies already shared with recipients you approved or that we must keep by law.',
        },
        {
          p: '**Information about other people.** Claims often name suspected scammers or witnesses. Submit only information that is relevant to your claim, and do not use Celia to harass, threaten or publicly expose anyone.',
        },
      ],
    },
    {
      title: 'Pooled claims',
      blocks: [
        {
          p: 'If your claim matches others (for example, the same scam wallet or website), we may invite you to join a pooled case. Joining is your choice. Other victims in a pooled case see only anonymised facts unless you agree otherwise. You can leave a pooled case at any time, but you may not be able to withdraw information already passed to a law firm or authority with your consent.',
        },
      ],
    },
    {
      title: 'Law firms, investigators and authorities',
      blocks: [
        {
          ul: [
            'We share your claim file only with recipients you approve, and we show you who they are before sharing.',
            'Partner firms are independent. They decide for themselves whether to take a case, and they, not Celia, are responsible for their legal work.',
            'Any legal fees, including contingency fees, are agreed directly between you and the firm in writing.',
            'Celia does not control, and is not responsible for, the outcome of any legal action, investigation or report.',
          ],
        },
      ],
    },
    {
      title: 'Fees',
      blocks: [
        {
          p: 'Filing a claim on Celia is free for victims. We will tell you before any fee applies to you, and you will never be charged without your clear agreement.',
        },
      ],
    },
    {
      title: 'Prohibited conduct',
      blocks: [
        { p: 'You must not:' },
        {
          ul: [
            'file false, duplicate or fraudulent claims, or impersonate anyone;',
            'use the Services to commit, plan or hide fraud, money laundering or sanctions breaches;',
            'upload malware, or try to access accounts, data or systems you are not authorised to use;',
            'scrape, copy or resell data from the Services, or use it to contact or target victims;',
            'harass, threaten or publish personal information about anyone named in a claim;',
            'pose as Celia or a partner firm, or offer “fund recovery” services using Celia’s name;',
            'break any law or anyone else’s rights.',
          ],
        },
      ],
    },
    {
      title: 'Third-party services and blockchains',
      blocks: [
        {
          p: 'The Services link to or rely on third parties such as blockchain networks, explorers, exchanges, wallet providers and identity-verification providers. We do not control them and are not responsible for their content, availability or actions. Blockchain records are public and cannot be changed or deleted by anyone, including Celia.',
        },
      ],
    },
    {
      title: 'Celia’s intellectual property',
      blocks: [
        {
          p: 'Celia owns the Services, including our software, design, logos, analytics, reports and anonymised data sets. We give you a limited, personal, non-transferable licence to use the Services under these Terms. You may not copy, modify or reverse-engineer the Services except as the law allows. If you send us feedback, we may use it freely without paying you.',
        },
      ],
    },
    {
      title: 'Suspension and termination',
      blocks: [
        {
          p: 'You can close your account at any time by contacting us. We may suspend or close your account, or remove a claim, if you break these Terms, if we reasonably suspect fraud or abuse, or if the law requires it. Where it is safe and lawful, we will tell you why and give you a chance to respond. After closure, we handle your data as set out in our Privacy Notice. Sections 5 (licence for already-shared content), 11, and 13 to 17 continue after closure.',
        },
      ],
    },
    {
      title: 'Disclaimers',
      blocks: [
        {
          p: 'THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE”. TO THE FULLEST EXTENT THE LAW ALLOWS, CELIA DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, ACCURACY AND NON-INFRINGEMENT. Blockchain analysis involves judgement and may be incomplete or wrong; we do not warrant that any wallet, transaction or person is correctly identified.',
        },
      ],
    },
    {
      title: 'Limitation of liability',
      blocks: [
        { p: 'TO THE FULLEST EXTENT THE LAW ALLOWS:' },
        {
          ul: [
            'CELIA IS NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST DATA OR LOST CRYPTO-ASSETS, INCLUDING THE ORIGINAL LOSS FROM THE FRAUD YOU REPORT;',
            'CELIA IS NOT LIABLE FOR THE ACTS OR OMISSIONS OF LAW FIRMS, INVESTIGATORS, AUTHORITIES, EXCHANGES OR OTHER THIRD PARTIES;',
            'CELIA’S TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICES IS LIMITED TO THE GREATER OF THE AMOUNT YOU PAID CELIA IN THE 12 MONTHS BEFORE THE CLAIM, OR US$100.',
          ],
        },
        {
          p: 'These limits do not apply to liability that cannot be limited by law, such as for fraud or gross negligence.',
        },
        {
          p: '**Indemnity.** You agree to cover Celia’s reasonable losses and legal costs arising from a false claim you file, Your Content, or your breach of these Terms.',
        },
      ],
    },
    {
      title: 'Dispute resolution and arbitration',
      blocks: [
        { p: '**Please read this section carefully. It affects your right to go to court.**' },
        {
          ul: [
            `**Talk to us first.** Before starting any formal claim against Celia, email ${legalEmail} describing the issue. We will try to resolve it informally within 60 days.`,
            '**Binding arbitration.** If we cannot resolve it, any dispute between you and Celia about the Services or these Terms will be settled by binding individual arbitration administered by JAMS under its Streamlined Arbitration Rules, before one arbitrator. The arbitration may be held by video or in San Francisco County, or in the county where you live if you prefer. For consumer claims, Celia pays the JAMS fees beyond what you would pay to file in court.',
            '**Exceptions.** Either party may bring an individual claim in small claims court, or seek an injunction in court to protect intellectual property. Nothing here stops you from reporting to a government agency or seeking public injunctive relief where California law does not allow that right to be waived.',
            '**Class-action waiver.** Disputes with Celia are resolved only on an individual basis, not as a class, collective or representative action. This waiver concerns disputes against Celia only; it does not limit the pooled claims you bring against fraudsters or others through partner law firms.',
            `**Opt-out.** You can opt out of this arbitration agreement by emailing ${legalEmail} within 30 days of first accepting these Terms, with your name and a clear statement that you opt out.`,
            'If the class-action waiver is found unenforceable for a dispute, this arbitration section does not apply to that dispute, which will go to the courts named in section 16.',
          ],
        },
      ],
    },
    {
      title: 'Governing law and venue',
      blocks: [
        {
          p: 'These Terms are governed by the laws of the State of California and applicable US federal law, including the Federal Arbitration Act, without regard to conflict-of-law rules. Any dispute not subject to arbitration will be heard only in the state or federal courts in San Francisco County, California, and you and Celia agree to their jurisdiction.',
        },
      ],
    },
    {
      title: 'General terms',
      blocks: [
        {
          ul: [
            '**Changes.** We may update these Terms. For material changes, we will notify you by email or in the app at least 30 days before they take effect. If you keep using the Services after that date, you accept the new Terms. Changes do not apply to disputes already notified to us.',
            '**Entire agreement.** These Terms and our Privacy Notice are the whole agreement between you and Celia about the Services.',
            '**Severability.** If any part of these Terms is unenforceable, the rest stays in effect.',
            '**No waiver.** Our not enforcing a term is not a waiver of our right to do so later.',
            '**Assignment.** You may not transfer these Terms without our consent. We may transfer them in a merger, acquisition or sale of assets.',
            '**Notices.** We send notices to the email on your account. You send notices to the address below.',
            '**California consumers.** Under California Civil Code § 1789.3, you may contact the Complaint Assistance Unit of the California Department of Consumer Affairs at 1625 North Market Blvd., Suite N 112, Sacramento, CA 95834, or (800) 952-5210.',
          ],
        },
      ],
    },
    {
      title: 'Contact us',
      blocks: [{ p: `Celia, Inc.\nSan Francisco, CA [ZIP], United States\nEmail: ${legalEmail}` }],
    },
  ],
};
