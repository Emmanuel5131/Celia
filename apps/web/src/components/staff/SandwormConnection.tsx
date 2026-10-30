'use client';

import { CheckIcon, PlugsConnectedIcon } from '@phosphor-icons/react';
import { useFormatter, useTranslations } from 'next-intl';
import * as React from 'react';
import { disconnectSandworm } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <dt className="text-xs text-ink-muted">{props.label}</dt>
      <dd className="text-sm">{props.children}</dd>
    </div>
  );
}

function DisconnectDialog() {
  const t = useTranslations('Staff');
  const [pending, startTransition] = React.useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost">{t('sandworm_disconnect')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('sandworm_disconnect_title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('sandworm_disconnect_text')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('sandworm_disconnect_keep')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              startTransition(disconnectSandworm);
            }}
          >
            {t('sandworm_disconnect')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The staff member's own Sandworm connection as one card: what it is and whether it is on, the facts an admin looks for (since
 * when, which workspace, the last call) and the actions. Connecting is a plain form, not a Link, because the sign-in leaves for
 * Sandworm's page and the browser has to make the whole trip. Disconnecting asks first.
 * @param props - The card props.
 * @param props.connectedAt - When they connected, as an ISO time, or null when they have not.
 * @param props.lastCallAt - When Celia last sent one of their calls on, as an ISO time, or null.
 * @param props.workspaceId - The Celia workspace every call goes to.
 * @returns The card.
 */
export function SandwormConnection(props: {
  connectedAt: string | null;
  lastCallAt: string | null;
  workspaceId: string | null;
}) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const connected = props.connectedAt !== null;

  return (
    <Card variant="outline">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center bg-paper text-ink">
            <PlugsConnectedIcon aria-hidden="true" />
          </div>
          <div className="grid gap-1">
            <CardTitle>{t('sandworm_card_title')}</CardTitle>
            <CardDescription>
              {connected ? t('sandworm_card_connected') : t('sandworm_card_not_connected')}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          {connected ? (
            <Badge variant="solid">
              <CheckIcon aria-hidden="true" />
              {t('sandworm_status_connected')}
            </Badge>
          ) : (
            <Badge variant="dashed">{t('sandworm_status_not_connected')}</Badge>
          )}
        </CardAction>
      </CardHeader>
      {props.connectedAt && (
        <CardContent>
          <dl className="grid gap-6 border-t border-line-soft pt-6 sm:grid-cols-3">
            <Field label={t('sandworm_field_since')}>
              {format.dateTime(new Date(props.connectedAt), { dateStyle: 'long' })}
            </Field>
            <Field label={t('sandworm_field_workspace')}>
              <span className="font-mono" title={props.workspaceId ?? undefined}>
                {props.workspaceId?.slice(0, 8)}
              </span>
            </Field>
            <Field label={t('sandworm_field_last_call')}>
              {props.lastCallAt
                ? format.dateTime(new Date(props.lastCallAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : t('sandworm_no_calls')}
            </Field>
          </dl>
        </CardContent>
      )}
      <CardContent className="flex flex-wrap items-center gap-4">
        <form action="/api/sandworm/connect">
          <Button type="submit" variant={connected ? 'outline' : 'default'}>
            {connected ? t('sandworm_reconnect') : t('sandworm_connect')}
          </Button>
        </form>
        {connected && <DisconnectDialog />}
      </CardContent>
    </Card>
  );
}
