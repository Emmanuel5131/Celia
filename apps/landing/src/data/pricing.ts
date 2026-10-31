import { appLogin } from './app';
import { site } from './site';

/**
 * The two ways to use Celia. No amount is shown for the enterprise plan: access starts with a conversation. Celia holds no funds and
 * promises no outcome, so neither plan does.
 */
export const pricing = {
  title: 'Free to report. Talk to us for the rest.',
  lead: 'Reporting a case costs an individual nothing. Organisations that need the whole case bank, or have a very special case, start with a conversation.',
  plans: [
    {
      id: 'individual',
      label: 'For individuals',
      price: 'Free',
      title: 'Report your case.',
      text: 'Add your wallet and a few lines about what happened. It joins the claims of others affected by the same platform, so a lawyer can see the whole picture.',
      points: [
        'Add your wallet and your account of what happened',
        'Prove ownership by signing from your wallet',
        'See where your file stands',
        'Choose whether verified organisations may ask to contact you',
      ],
      note: 'Celia can’t promise that a lawyer takes your case or that you recover anything.',
      cta: { label: 'Report fraud', href: appLogin },
    },
    {
      id: 'enterprise',
      label: 'Enterprise',
      price: 'Let’s talk',
      title: 'Next or very special cases.',
      text: 'For law firms, investigators and organisations that need full access to the case bank, or a very special case. Access starts with a conversation, then a review of your organisation.',
      points: [
        'The full case lists, not a preview',
        'Requests to contact the claimants who agree to be reached',
        'The MCP, for your own assistants',
        'A review of your organisation before access opens',
      ],
      note: 'Celia holds no funds. Any fee for running a case is agreed between you and the people you act for.',
      cta: {
        label: 'Start the conversation',
        href: `mailto:${site.email}?subject=${encodeURIComponent('Enterprise access')}`,
      },
    },
  ],
} as const;
