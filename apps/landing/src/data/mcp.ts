/**
 * The MCP page: Celia's research reports, readable by an AI assistant. Reports only: no victim details leave Celia. Words follow
 * the house language: the reports establish what the chain shows and declare no fraud.
 */
export const mcp = {
  eyebrow: 'MCP',
  title: 'Fraud research,\nfor your AI assistant.',
  lead: 'The Celia MCP lets an AI assistant read our research reports: what the chain shows about a platform, what is proven and what is not proven.',
  cta: { label: 'Request access', subject: 'Celia MCP access' },
  features: [
    { title: 'Research reports', text: 'Read the report on a platform: the findings, the estimated wallets affected and losses, and what each finding establishes.' },
    { title: 'Proven and not proven', text: 'Every finding is split into what the chain establishes and what it does not. The assistant quotes the split as it is written.' },
    { title: 'Evidence rules', text: 'Look up the rule that decides whether electronic evidence is accepted in a jurisdiction, with the research notes behind it.' },
    { title: 'Reports only', text: 'No victim names, wallets or statements. What victims share stays private, shared only with the lawyer or firm on the case.' },
  ],
  process: {
    title: 'From claim to case.',
    lead: 'Celia is built to take in thousands of claims. AI agents do the first pass, checking each claim against onchain evidence and offchain records. People do the rest: they onboard every organisation, organise claims into cases, and review and confirm every result. We build the base case that researchers, law firms, investigators and law enforcement can use to build credible crypto fraud cases.',
    steps: [
      { title: 'Victims send claims', text: 'People tell us what happened and prove the wallet is theirs. A claim stays alleged until it is verified.' },
      { title: 'An agent and a person verify', text: 'An AI agent helps check each claim against onchain evidence and offchain records. A person at Celia reviews everything and confirms it. The agent never confirms a claim.' },
      { title: 'Everyone builds the case', text: 'Confirmed claims are pooled into one base case. Researchers, law firms, investigators and law enforcement start from it and build on the same verified evidence.' },
    ],
  },
  asksLabel: 'Questions you can ask',
  asks: [
    'What does the report say about this platform?',
    'Which findings are not proven yet?',
    'How many wallets are estimated to be affected?',
    'Which rule decides electronic evidence in New York?',
  ],
  note: 'Reports describe what the chain shows. They declare no fraud: a court decides intent. These are research notes, not legal advice.',
};

/** The short MCP section on the homepage. It says who gets what; the MCP page has the rest. */
export const mcpTeaser = {
  eyebrow: 'MCP',
  title: 'The case bank,\nin your AI assistant.',
  lead: 'Connect an AI assistant to Celia. It reads the case bank, helps research a case and drafts the findings. People at Celia review and confirm everything.',
  roles: [
    { who: 'People who lost money', text: 'Ask about your own claims: what you sent and whether Celia has confirmed it.' },
    { who: 'Law firms', text: 'Review the cases your firm leads and the claims in them, with no names and no statements.' },
    { who: 'Celia staff', text: 'See what is waiting for review, and save a research report once a person has approved it.' },
  ],
  cta: { label: 'How the MCP works', href: '/mcp/' },
};
