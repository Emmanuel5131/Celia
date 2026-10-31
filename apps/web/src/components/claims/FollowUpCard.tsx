'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import type { ClaimState } from '@/app/[locale]/(auth)/dashboard/claims/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFormAction } from '@/hooks/use-form-action';
import { followUpChannels } from '@/utils/claims/FollowUp';
import type { FollowUpChannel } from '@/utils/claims/FollowUp';

/**
 * Asked once a claim is sent: how Celia should follow up. It says plainly that the details are kept only for follow-up and are
 * shared with no one unless the person explicitly agrees. Email needs nothing more, because it uses the account's address; a phone
 * or messaging app needs a number or handle. Everything can be changed or deleted.
 * @param props - The card props.
 * @param props.saved - What the person gave before, if anything.
 * @param props.saved.channel - The way they chose.
 * @param props.saved.value - The number or handle, if the way needs one.
 * @param props.saved.bestTime - The good time and language, if given.
 * @param props.action - The server action that saves the details.
 * @param props.remove - The server action that deletes them.
 * @returns The card.
 */
export function FollowUpCard(props: {
  saved?: { channel: FollowUpChannel; value: string | null; bestTime: string | null };
  action: (state: ClaimState, formData: FormData) => Promise<ClaimState>;
  remove: () => Promise<void>;
}) {
  const t = useTranslations('ClaimPage');
  const { state, onSubmit, pending } = useFormAction(props.action, { errors: [] });
  const [removing, startRemoving] = React.useTransition();
  const [channel, setChannel] = React.useState<FollowUpChannel>(props.saved?.channel ?? 'email');

  return (
    <Card variant="outline">
      <CardHeader>
        <CardTitle className="font-sans text-base font-medium">{t('followup_title')}</CardTitle>
        <CardDescription>{t('followup_text')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="followup-channel">{t('followup_channel_label')}</Label>
            <Select
              name="channel"
              value={channel}
              onValueChange={(next) => {
                setChannel(followUpChannels.find((value) => value === next) ?? 'email');
              }}
            >
              <SelectTrigger id="followup-channel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {followUpChannels.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`followup_channel_${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {channel !== 'email' && (
            <div className="grid gap-2">
              <Label htmlFor="followup-value">{t(`followup_value_label_${channel}`)}</Label>
              <Input
                id="followup-value"
                name="value"
                defaultValue={props.saved?.value ?? ''}
                maxLength={120}
                required
              />
              {state.errors.includes('value') && (
                <p role="alert" className="text-sm text-seal">
                  {t('followup_error_value')}
                </p>
              )}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="followup-time">{t('followup_time_label')}</Label>
            <Input
              id="followup-time"
              name="bestTime"
              defaultValue={props.saved?.bestTime ?? ''}
              placeholder={t('followup_time_placeholder')}
              maxLength={120}
            />
          </div>
          {state.errors.includes('bestTime') && (
            <p role="alert" className="text-sm text-seal">
              {t('followup_error_other')}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {t('followup_save')}
            </Button>
            {props.saved && (
              <Button
                type="button"
                variant="outline"
                disabled={removing}
                onClick={() => {
                  startRemoving(async () => {
                    await props.remove();
                  });
                }}
              >
                {t('followup_remove')}
              </Button>
            )}
            {state.done && <span className="text-sm text-ink-muted">{t('followup_saved')}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
