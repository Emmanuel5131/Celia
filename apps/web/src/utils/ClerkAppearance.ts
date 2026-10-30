import type { ClerkProvider } from '@clerk/nextjs';
import type { ComponentProps } from 'react';

// Only Google, Microsoft and email with a password are offered (switch Microsoft on and the others off in the Clerk dashboard,
// under User & authentication → Social connections). The others are hidden here as well so no other button can appear.
const hiddenProviders = ['apple', 'discord', 'facebook', 'github'] as const;

const hiddenProviderElements = Object.fromEntries(
  hiddenProviders.flatMap((provider) => [
    [`socialButtonsBlockButton__${provider}`, 'hidden'],
    [`socialButtonsIconButton__${provider}`, 'hidden'],
  ]),
);

/**
 * Clerk's look, mapped onto the Celia tokens (docs/DESIGN.md): ink on white, 44px square fields, pill buttons, no card shadow. The
 * social buttons sit below the form, side by side, slightly rounded with a light grey border. A field has one border, which turns
 * ink when it has focus; the icons inside the email and password fields are drawn in `global.css`.
 * The `clerk` CSS layer keeps Clerk below our Tailwind utilities. Clerk also caps control heights with `max-height`,
 * which is why every control below resets it.
 */
export const clerkAppearance: ComponentProps<typeof ClerkProvider>['appearance'] = {
  cssLayerName: 'clerk',
  options: {
    socialButtonsVariant: 'blockButton',
    socialButtonsPlacement: 'bottom',
    shimmer: false,
  },
  variables: {
    colorPrimary: 'var(--color-ink)',
    colorBackground: 'var(--color-surface)',
    colorForeground: 'var(--color-ink)',
    colorMutedForeground: 'var(--color-ink-muted)',
    colorDanger: 'var(--color-seal)',
    colorInput: 'var(--color-surface)',
    colorInputForeground: 'var(--color-ink)',
    borderRadius: '0',
    fontFamily: 'var(--font-mulish), system-ui, sans-serif',
    fontSize: '0.9375rem',
  },
  elements: {
    ...hiddenProviderElements,
    rootBox: 'w-full',
    cardBox: 'w-full overflow-visible rounded-none border-0 shadow-none',
    card: 'm-0 w-full gap-6 rounded-none border-0 bg-transparent p-0 shadow-none',
    header: 'hidden',
    footer: 'bg-none',
    footerAction: 'justify-center',
    footerActionText: 'text-sm text-ink-muted',
    main: 'gap-6',
    form: 'gap-6',
    formFieldRow: 'gap-2',
    formFieldLabel: 'text-sm font-medium text-ink',
    formFieldInput:
      'h-(--control-md) max-h-none rounded-none border-0 bg-surface px-3 text-base text-ink shadow-none ring-1 ring-input outline-none focus:ring-2 focus:ring-ink focus-visible:outline-none',
    formFieldInput__identifier: 'pl-10',
    formFieldInput__emailAddress: 'pl-10',
    formFieldInput__password: 'pl-10',
    // Clerk insets the organization form by 40px; without it the form lines up with the choice cards above it.
    formContainer: 'p-0',
    avatarImageActionsUpload:
      'h-(--control-sm) max-h-none rounded-[6px] border border-line bg-surface px-4 text-sm font-medium text-ink shadow-none hover:bg-ink/6 active:bg-ink/10 focus-ring',
    avatarImageActionsRemove:
      'h-(--control-sm) max-h-none rounded-[6px] px-3 text-sm font-medium text-ink-muted shadow-none hover:bg-ink/6 hover:text-ink active:bg-ink/10 focus-ring',
    formFieldInputShowPasswordButton: 'text-ink-muted hover:text-ink',
    formFieldErrorText: 'text-xs text-seal',
    formFieldHintText: 'text-xs text-ink-muted',
    formButtonPrimary:
      'h-(--control-md) max-h-none rounded-full border-[1.5px] border-ink bg-ink bg-none text-base font-bold normal-case text-on-ink shadow-none after:hidden before:hidden hover:bg-ink-hover focus-ring',
    buttonArrowIcon: 'hidden',
    socialButtonsRoot: 'w-full',
    // Two providers sit side by side; a single one takes the whole row.
    socialButtons: 'w-full grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-3',
    socialButtonsBlockButton:
      'h-(--control-md) max-h-none w-full min-w-0 rounded-[6px] border border-line bg-surface text-ink shadow-none hover:bg-ink/6 active:bg-ink/10 focus-ring',
    socialButtonsBlockButtonText: 'text-base font-medium text-ink',
    dividerRow: 'gap-4',
    dividerLine: 'bg-line',
    dividerText: 'text-sm text-ink-muted',
    formResendCodeLink: 'font-medium text-ink underline underline-offset-4',
    footerActionLink:
      'text-sm font-medium text-ink underline underline-offset-4 hover:text-ink-muted',
    identityPreview: 'rounded-none border-0 shadow-none ring-[1.5px] ring-input',
    alert: 'rounded-none border border-seal bg-surface text-seal shadow-none',
    alertText: 'text-sm text-seal',
    otpCodeFieldInput:
      'h-(--control-lg) max-h-none rounded-none border-0 shadow-none ring-1 ring-input outline-none focus:ring-2 focus:ring-ink focus-visible:outline-none',
  },
};
