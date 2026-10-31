'use client';

import { signOwnership } from '@celia/core';
import type { ChainId, SignFailure } from '@celia/core';
import { CopyIcon, WalletIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import type { ClaimState } from '@/app/[locale]/(auth)/dashboard/claims/actions';
import { FieldMessage } from '@/components/claims/FieldMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFormAction } from '@/hooks/use-form-action';
import { findBrowserWallet } from '@/utils/claims/BrowserWallet';
import { proofFileLimits } from '@/utils/claims/ProofFile';

export type OwnershipAction = (state: ClaimState, formData: FormData) => Promise<ClaimState>;

// The exact text that will be signed, in a box that can be read and copied.
function MessageBox(props: { message: string; copy?: boolean }) {
  const t = useTranslations('ClaimPage');
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="grid gap-2">
      <Label htmlFor="message">{t('message_label')}</Label>
      <pre
        id="message"
        className="max-h-40 overflow-auto bg-paper p-3 font-mono text-xs whitespace-pre-wrap"
      >
        {props.message}
      </pre>
      {props.copy && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={async () => {
            await navigator.clipboard.writeText(props.message);
            setCopied(true);
          }}
        >
          <CopyIcon aria-hidden="true" />
          {copied ? t('copied') : t('copy')}
        </Button>
      )}
    </div>
  );
}

function StepText(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <h3 className="text-base font-medium">{props.title}</h3>
      <p className="text-sm text-ink-muted">{props.children}</p>
    </div>
  );
}

/**
 * Signing with a wallet in this browser: one click, and the wallet asks for one message. The signature goes straight to the check.
 * @param props - The step props.
 * @param props.chain - The claim's chain.
 * @param props.address - The wallet on the claim.
 * @param props.message - The text to sign.
 * @param props.action - The server action that checks a signature.
 * @param props.onUseHand - Called when the person would rather sign by hand.
 * @returns The step.
 */
export function WalletWay(props: {
  chain: ChainId;
  address: string;
  message: string;
  action: OwnershipAction;
  onUseHand: () => void;
}) {
  const t = useTranslations('ClaimPage');
  const { state, submit, pending } = useFormAction(props.action, { errors: [] });
  const [failure, setFailure] = React.useState<'none' | SignFailure | null>(null);
  const [working, setWorking] = React.useState(false);

  const sign = async () => {
    const wallet = findBrowserWallet(props.chain);

    if (!wallet) {
      setFailure('none');

      return;
    }

    setFailure(null);
    setWorking(true);
    const outcome = await signOwnership(wallet, props);
    setWorking(false);

    if (!outcome.ok) {
      setFailure(outcome.reason);

      return;
    }

    const data = new FormData();
    data.set('signature', outcome.signature);
    submit(data);
  };
  const problem = failure ?? (state.errors.includes('signature') ? ('signature' as const) : null);

  return (
    <div className="grid gap-4">
      <StepText title={t('own_wallet_title')}>{t('own_wallet_text')}</StepText>
      <MessageBox message={props.message} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={working || pending} onClick={sign}>
          <WalletIcon aria-hidden="true" />
          {working ? t('own_wallet_working') : t('own_wallet_button')}
        </Button>
        <Button type="button" variant="ghost" onClick={props.onUseHand}>
          {t('own_use_hand')}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-seal">
          {t(`own_wallet_${problem}`, { address: props.address })}
        </p>
      )}
    </div>
  );
}

/**
 * Signing by hand, first half: read and copy the message. Anyone with a hardware or phone wallet can do this.
 * @param props - The step props.
 * @param props.message - The text to sign.
 * @param props.tool - A page where the message can be signed, when there is a good one for the chain.
 * @param props.inBrowser - Whether the chain has a one-click wallet button, which changes what to suggest without a signing site.
 * @param props.onNext - Called when the person has copied it.
 * @returns The step.
 */
export function HandCopy(props: {
  message: string;
  tool: { name: string; url: string } | null;
  inBrowser: boolean;
  onNext: () => void;
}) {
  const t = useTranslations('ClaimPage');

  return (
    <div className="grid gap-4">
      <StepText title={t('own_hand_copy_title')}>{t('own_hand_copy_text')}</StepText>
      <MessageBox message={props.message} copy />
      {props.tool ? (
        <p className="text-sm text-ink-muted">
          {props.tool.name === 'Etherscan' ? t('own_tool_etherscan') : t('own_tool_tronscan')}{' '}
          <a
            href={props.tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink underline underline-offset-4 focus-ring"
          >
            {t('own_tool_open', { name: props.tool.name })}
          </a>
        </p>
      ) : (
        <p className="text-sm text-ink-muted">
          {props.inBrowser ? t('own_tool_none') : t('own_tool_bitcoin')}
        </p>
      )}
      <Button type="button" className="justify-self-start" onClick={props.onNext}>
        {t('own_hand_next')}
      </Button>
    </div>
  );
}

/**
 * Signing by hand, second half: paste the signature the wallet gave.
 * @param props - The step props.
 * @param props.action - The server action that checks a signature.
 * @returns The step.
 */
export function HandPaste(props: { action: OwnershipAction }) {
  const t = useTranslations('ClaimPage');
  const { state, onSubmit, pending } = useFormAction(props.action, { errors: [] });

  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      <StepText title={t('own_hand_sign_title')}>{t('own_hand_sign_text')}</StepText>
      <div className="grid gap-2">
        <Label htmlFor="signature">{t('signature_label')}</Label>
        <Textarea
          id="signature"
          name="signature"
          rows={3}
          className="font-mono"
          spellCheck={false}
          aria-invalid={state.errors.includes('signature')}
        />
        <FieldMessage show={state.errors.includes('signature')}>
          {t('ownership_failed')}
        </FieldMessage>
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {t('verify')}
      </Button>
    </form>
  );
}

/**
 * Making a video: what to say and show, where to put it, and a box for the link. The video stays where the person uploads it; staff
 * watch it from the link.
 * @param props - The step props.
 * @param props.action - The server action that records the link.
 * @param props.link - The link already sent, which sending another replaces.
 * @returns The step.
 */
export function VideoWay(props: { action: OwnershipAction; link: string | null }) {
  const t = useTranslations('ClaimPage');
  const { state, onSubmit, pending } = useFormAction(props.action, { errors: [] });

  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      <p className="text-sm text-ink-muted">{t('own_video_text')}</p>
      <p className="border border-border bg-paper p-3 text-sm">{t('own_video_quality')}</p>
      <div className="grid gap-2">
        <p className="text-sm font-medium">{t('own_video_show')}</p>
        <ol className="grid list-decimal gap-1 pl-5 text-sm">
          <li>{t('own_video_show_who')}</li>
          <li>{t('own_video_show_wallet')}</li>
          <li>{t('own_video_show_tx')}</li>
          <li>{t('own_video_show_sign')}</li>
          <li>{t('own_video_show_story')}</li>
        </ol>
      </div>
      <p className="border border-border bg-paper p-3 text-sm font-medium">{t('own_video_safe')}</p>
      <p className="text-sm text-ink-muted">
        {t('own_video_where')}{' '}
        {t.rich('own_video_loom_help', {
          link: (chunks) => (
            <a
              href="https://www.loom.com/screen-recorder"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 focus-ring"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
      <div className="grid gap-2">
        <Label htmlFor="video-link">{t('own_video_link_label')}</Label>
        <Input
          id="video-link"
          name="link"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          defaultValue={props.link ?? ''}
          aria-invalid={state.errors.includes('link')}
        />
        <FieldMessage show={state.errors.includes('link')}>
          {t('own_video_link_error')}
        </FieldMessage>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="video-note">{t('own_docs_note_label')}</Label>
        <Textarea
          id="video-note"
          name="note"
          rows={2}
          aria-invalid={state.errors.includes('note')}
        />
        <FieldMessage show={state.errors.includes('note')}>{t('own_err_note')}</FieldMessage>
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {t('own_video_button')}
      </Button>
    </form>
  );
}

/**
 * Sending screenshots or receipts for staff to look at. The file types and sizes are the ones the server accepts.
 * @param props - The step props.
 * @param props.action - The server action that stores the files.
 * @returns The step.
 */
export function DocumentsWay(props: { action: OwnershipAction }) {
  const t = useTranslations('ClaimPage');
  const { state, onSubmit, pending } = useFormAction(props.action, { errors: [] });
  const fileError = (['files', 'files_type', 'files_size', 'files_count'] as const).find((name) =>
    state.errors.includes(name),
  );

  return (
    <form className="grid gap-4" noValidate onSubmit={onSubmit}>
      <p className="text-sm text-ink-muted">{t('own_docs_text')}</p>
      <ul className="grid list-disc gap-1 pl-5 text-sm">
        <li>{t('own_docs_example_app')}</li>
        <li>{t('own_docs_example_receipt')}</li>
        <li>{t('own_docs_example_history')}</li>
      </ul>
      <p className="border border-border bg-paper p-3 text-sm font-medium">{t('own_docs_safe')}</p>
      <div className="grid gap-2">
        <Label htmlFor="files">
          {t('own_docs_files_label', {
            size: proofFileLimits.bytes / (1024 * 1024),
            count: proofFileLimits.perSend,
          })}
        </Label>
        <Input
          id="files"
          name="files"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          aria-invalid={fileError !== undefined}
        />
        <FieldMessage show={fileError !== undefined}>
          {t(`own_err_${fileError ?? 'files'}`)}
        </FieldMessage>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="docs-note">{t('own_docs_note_label')}</Label>
        <Textarea id="docs-note" name="note" rows={2} />
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {t('own_docs_button')}
      </Button>
    </form>
  );
}
