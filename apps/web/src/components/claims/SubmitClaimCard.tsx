'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import type { ClaimState } from '@/app/[locale]/(auth)/dashboard/claims/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useFormAction } from '@/hooks/use-form-action';

/**
 * The last step: send the claim. The person first agrees that it can be shared with the people working on their case, and the
 * button stays off until they do. Once sent, it shows a confirmation instead.
 * @param props - The card props.
 * @param props.sent - Whether the claim has already been sent.
 * @param props.ready - Whether the claim has what it needs to be sent: the person's own account of what happened.
 * @param props.late - Whether the claim was sent after the case's evidence file was sealed.
 * @param props.others - How many other people have reported the same operator.
 * @param props.platform - The operator's name, if the person gave one.
 * @param props.action - The server action that sends it.
 * @returns The card.
 */
export function SubmitClaimCard(props: {
  sent: boolean;
  ready: boolean;
  others: number;
  late: boolean;
  platform: string | null;
  action: (state: ClaimState, formData: FormData) => Promise<ClaimState>;
}) {
  const t = useTranslations('ClaimPage');
  const { state, onSubmit, pending } = useFormAction(props.action, { errors: [] });
  const [agreed, setAgreed] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [truthful, setTruthful] = React.useState(false);

  return (
    <Card variant="outline">
      <CardHeader>
        <CardTitle className="font-sans text-base font-medium">
          {props.sent ? t('sent_title') : t('submit_title')}
        </CardTitle>
        <CardDescription>
          {props.sent ? t(props.late ? 'sent_late_text' : 'sent_text') : t('submit_text')}
        </CardDescription>
      </CardHeader>
      {!props.sent && (
        <CardContent className="grid gap-4">
          <form className="grid gap-4" onSubmit={onSubmit}>
            {props.others > 0 && (
              <p className="text-sm font-medium">
                {props.platform
                  ? t('submit_others', { count: props.others, platform: props.platform })
                  : t('submit_others_unnamed', { count: props.others })}
              </p>
            )}
            {state.errors.includes('statement') && (
              <p role="alert" className="text-sm text-seal">
                {t('error_statement_first')}
              </p>
            )}
            {!props.ready && (
              <p className="text-sm text-ink-muted">{t('submit_needs_statement')}</p>
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="claim-consent"
                name="consent"
                className="mt-1"
                checked={agreed}
                onCheckedChange={(next) => {
                  setAgreed(next === true);
                }}
              />
              <Label htmlFor="claim-consent" className="leading-relaxed font-normal">
                {t('consent_label')}
              </Label>
            </div>
            {state.errors.includes('consent') && (
              <p role="alert" className="text-sm text-seal">
                {t('error_consent')}
              </p>
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="claim-connect"
                name="connect"
                className="mt-1"
                checked={connected}
                onCheckedChange={(next) => {
                  setConnected(next === true);
                }}
              />
              <Label htmlFor="claim-connect" className="leading-relaxed font-normal">
                {t('connect_label')}
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="claim-contact" name="contact" className="mt-1" />
              <Label htmlFor="claim-contact" className="leading-relaxed font-normal">
                {t('contact_label')}
              </Label>
            </div>
            {state.errors.includes('connect') && (
              <p role="alert" className="text-sm text-seal">
                {t('error_connect')}
              </p>
            )}
            <div className="flex items-start gap-3">
              <Checkbox
                id="claim-truthful"
                name="truthful"
                className="mt-1"
                checked={truthful}
                onCheckedChange={(next) => {
                  setTruthful(next === true);
                }}
              />
              <Label htmlFor="claim-truthful" className="leading-relaxed font-normal">
                {t('truthful_label')}
              </Label>
            </div>
            {state.errors.includes('truthful') && (
              <p role="alert" className="text-sm text-seal">
                {t('error_truthful')}
              </p>
            )}
            {state.errors.includes('limit') && (
              <p role="alert" className="text-sm text-seal">
                {t('error_limit')}
              </p>
            )}
            <Button
              type="submit"
              disabled={pending || !props.ready || !agreed || !connected || !truthful}
              className="justify-self-start"
            >
              {t('submit')}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
