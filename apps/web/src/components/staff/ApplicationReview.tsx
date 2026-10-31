'use client';

import { getJurisdiction } from '@celia/jurisdictions';
import { useFormatter, useTranslations } from 'next-intl';
import * as React from 'react';
import {
  approveApplication,
  markApplicationReady,
  rejectApplication,
  runApplicationLookups,
  setApplicationCheck,
} from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { PageSection } from '@/components/layout/PageSection';
import { ApplicationStatusBadge } from '@/components/staff/ApplicationStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Timeline, TimelineItem } from '@/components/ui/timeline';
import type { ApplicationDetail, ApplicationInReview } from '@/libs/accounts/Applications';
import { useRouter } from '@/libs/I18nNavigation';
import { rejectReasons, reviewChecks } from '@/utils/accounts/Institution';
import type { LookupResult, ReviewCheck } from '@/utils/accounts/Institution';
import { jurisdictionName } from '@/utils/cases/JurisdictionName';

function Fact(props: { label: string; children?: React.ReactNode }) {
  const t = useTranslations('Staff');
  const empty = !props.children;

  return (
    <div className="grid gap-1">
      <dt className="text-xs text-ink-muted">{props.label}</dt>
      <dd className="text-sm break-words">
        {empty ? <span className="text-ink-muted">{t('app_none')}</span> : props.children}
      </dd>
    </div>
  );
}

function FactCard(props: { children: React.ReactNode }) {
  return (
    <Card variant="outline">
      <CardContent>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{props.children}</dl>
      </CardContent>
    </Card>
  );
}

function Lookup(props: { label: string; result: LookupResult }) {
  const t = useTranslations('Staff');

  return (
    <div className="grid gap-1">
      <p>
        <span className="text-ink-muted">{props.label}: </span>
        {t(`app_lookup_status_${props.result.status}`)}
      </p>
      {props.result.matches.length > 0 && (
        <ul className="grid gap-1 pl-4">
          {props.result.matches.map((match) => (
            <li key={`${match.name}${match.detail}`}>
              {match.link ? (
                <a
                  href={match.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 focus-ring"
                >
                  {match.name}
                </a>
              ) : (
                match.name
              )}
              <span className="text-ink-muted"> · {match.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Lookups(props: {
  item: ApplicationInReview;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const { lookups, lookedUpAt } = props.item;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {props.item.status === 'in_review' && (
          <Button
            size="sm"
            variant="outline"
            disabled={props.pending}
            onClick={() => {
              props.run(async () => {
                await runApplicationLookups(props.item.id);
              });
            }}
          >
            {t('app_lookup_run')}
          </Button>
        )}
        {lookedUpAt && (
          <span className="text-ink-muted">
            {t('app_lookup_when', {
              when: format.dateTime(new Date(lookedUpAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </span>
        )}
      </div>
      {lookups && (
        <>
          <Lookup label={t('app_lookup_registry')} result={lookups.registry} />
          <Lookup label={t('app_lookup_sanctions')} result={lookups.sanctions} />
          <p className="text-ink-muted">{t('app_lookup_note')}</p>
        </>
      )}
    </div>
  );
}

function Checks(props: {
  item: ApplicationInReview;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const t = useTranslations('Staff');

  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">{t('app_checks')}</legend>
      {reviewChecks.map((check: ReviewCheck) => (
        <div key={check} className="flex items-center gap-3">
          <Checkbox
            id={`${props.item.id}-${check}`}
            checked={props.item.checks[check] === true}
            disabled={props.pending || props.item.status !== 'in_review'}
            onCheckedChange={(next) => {
              props.run(async () => {
                await setApplicationCheck({ userId: props.item.id, check, value: next === true });
              });
            }}
          />
          <Label htmlFor={`${props.item.id}-${check}`} className="font-normal">
            {t(`app_check_${check}`)}
          </Label>
        </div>
      ))}
    </fieldset>
  );
}

function Decision(props: {
  item: ApplicationInReview;
  actorId: string;
  production: boolean;
  pending: boolean;
  run: (fn: () => Promise<unknown>) => void;
}) {
  const t = useTranslations('Staff');
  const router = useRouter();
  const [note, setNote] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [rejecting, setRejecting] = React.useState(false);
  const [message, setMessage] = React.useState<
    'checks_incomplete' | 'not_ready' | 'same_person' | 'missing' | 'note' | null
  >(null);
  const { item } = props;
  const complete = reviewChecks.every((check) => item.checks[check] === true);
  const ready = item.readyBy !== null;
  // The one who marked it ready cannot approve it in production; the server enforces it, this only says so.
  const ownReady = ready && item.readyBy === props.actorId && props.production;
  // The applicant sees the chosen reason, then any details staff added.
  const chosen = rejectReasons.find((value) => value === reason);
  const decisionNote = [chosen && t(`app_reason_${chosen}`), note.trim()].filter(Boolean).join(' ');

  return (
    <div className="grid gap-3">
      {message && (
        <p role="alert" className="text-seal">
          {t(`app_refusal_${message}`)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {!ready && (
          <Button
            size="sm"
            disabled={props.pending || !complete}
            onClick={() => {
              props.run(async () => {
                const result = await markApplicationReady(item.id);
                setMessage(result === 'ok' ? null : result);
              });
            }}
          >
            {t('app_mark_ready')}
          </Button>
        )}
        {ready && (
          <>
            <Badge variant="solid">{t('app_ready')}</Badge>
            <Button
              size="sm"
              disabled={props.pending || ownReady}
              onClick={() => {
                props.run(async () => {
                  const result = await approveApplication(item.id);
                  setMessage(result === 'ok' ? null : result);
                  if (result === 'ok') {
                    router.push('/dashboard/staff/applications');
                  }
                });
              }}
            >
              {t('app_approve')}
            </Button>
            {ownReady && <span className="text-ink-muted">{t('app_second_person')}</span>}
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={props.pending}
          onClick={() => {
            setRejecting(!rejecting);
          }}
        >
          {t('app_reject')}
        </Button>
      </div>
      {rejecting && (
        <div className="grid gap-2">
          <Label htmlFor={`${item.id}-reason`}>{t('app_reason_label')}</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id={`${item.id}-reason`} size="sm" className="w-full max-w-md">
              <SelectValue placeholder={t('app_reason_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {rejectReasons.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`app_reason_${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor={`${item.id}-note`}>{t('app_reject_note')}</Label>
          <Textarea
            id={`${item.id}-note`}
            value={note}
            maxLength={500}
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="justify-self-start"
            disabled={props.pending || decisionNote === '' || decisionNote.length > 500}
            onClick={() => {
              props.run(async () => {
                const result = await rejectApplication({
                  userId: item.id,
                  reason: chosen,
                  note,
                });
                setMessage(result === 'ok' ? null : result);
                if (result === 'ok') {
                  router.push('/dashboard/staff/applications');
                }
              });
            }}
          >
            {t('app_reject_confirm')}
          </Button>
        </div>
      )}
    </div>
  );
}

function Decided(props: { item: ApplicationInReview }) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const { item } = props;

  return (
    <FactCard>
      <Fact label={t('app_outcome')}>
        <ApplicationStatusBadge status={item.status} />
      </Fact>
      <Fact label={t('app_decided_on')}>
        {item.decidedAt &&
          format.dateTime(new Date(item.decidedAt), { dateStyle: 'medium', timeStyle: 'short' })}
      </Fact>
      {item.status === 'rejected' && (
        <Fact label={t('app_decision_note')}>{item.decisionNote}</Fact>
      )}
    </FactCard>
  );
}

function Organisation(props: { item: ApplicationInReview }) {
  const t = useTranslations('Staff');
  const { item } = props;
  const places = item.jurisdictions.map((id) => {
    const jurisdiction = getJurisdiction(id);

    return jurisdiction ? jurisdictionName(jurisdiction) : id;
  });

  return (
    <FactCard>
      <Fact label={t('app_kind_label')}>{t(`app_kind_${item.kind}`)}</Fact>
      <Fact label={t('app_organisation')}>{item.organisation ?? t('app_independent')}</Fact>
      <Fact label={t('app_registration')}>{item.registrationNumber}</Fact>
      <Fact label={t('app_role')}>{item.contactRole}</Fact>
      <Fact label={t('app_website')}>
        {item.website && (
          <a
            href={item.website}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 focus-ring"
          >
            {item.website}
          </a>
        )}
      </Fact>
      <Fact label={t('app_domain')}>{t(`app_domain_${item.domain}`)}</Fact>
      <Fact label={t('app_jurisdictions')}>
        {places.length > 0 && (
          <span className="flex flex-wrap gap-2">
            {places.map((place) => (
              <Badge key={place} variant="muted">
                {place}
              </Badge>
            ))}
          </span>
        )}
      </Fact>
    </FactCard>
  );
}

function Applicant(props: { detail: ApplicationDetail }) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const { item, account } = props.detail;
  const when = (value: string | null) =>
    value && format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <FactCard>
      <Fact label={t('app_name')}>{item.name}</Fact>
      <Fact label={t('app_email')}>
        {item.email && (
          <span className="flex flex-wrap items-center gap-2">
            {item.email}
            <Badge variant={account.emailVerified ? 'muted' : 'dashed'}>
              {t(account.emailVerified ? 'app_email_verified' : 'app_email_unverified')}
            </Badge>
          </span>
        )}
      </Fact>
      <Fact label={t('app_phone')}>{account.phones.join(', ')}</Fact>
      <Fact label={t('app_account_created')}>{when(account.createdAt)}</Fact>
      <Fact label={t('app_last_sign_in')}>{when(account.lastSignInAt)}</Fact>
      <Fact label={t('app_account_id')}>
        <span className="font-mono text-xs break-all">{item.id}</span>
      </Fact>
    </FactCard>
  );
}

function Submission(props: { detail: ApplicationDetail }) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const { item, readyAt, readyByName } = props.detail;
  const day = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <FactCard>
      <Fact label={t('app_sent')}>
        {format.dateTime(new Date(item.submittedAt), { dateStyle: 'medium', timeStyle: 'short' })}
      </Fact>
      <Fact label={t('app_decide_by')}>
        <span className="flex flex-wrap items-center gap-2">
          {day(item.dueAt)}
          {item.overdue && <Badge variant="solid">{t('app_overdue')}</Badge>}
        </span>
      </Fact>
      <Fact label={t('app_agreements')}>{t('app_agreements_text')}</Fact>
      <Fact label={t('app_ready_label')}>
        {readyAt && readyByName
          ? t('app_ready_by', { name: readyByName, date: day(readyAt) })
          : t('app_not_ready')}
      </Fact>
    </FactCard>
  );
}

function History(props: { detail: ApplicationDetail }) {
  const t = useTranslations('Staff');
  const format = useFormatter();

  if (props.detail.history.length === 0) {
    return <p className="text-sm text-ink-muted">{t('app_history_empty')}</p>;
  }

  return (
    <Timeline>
      {props.detail.history.map((entry) => {
        const check = reviewChecks.find((name) => name === entry.details.check);

        return (
          <TimelineItem key={entry.id}>
            <div className="grid gap-1 text-sm">
              <span>{t(`audit_action_${entry.action}`)}</span>
              {check && (
                <span className="text-ink-muted">
                  {t(
                    entry.details.value === 'true' ? 'app_history_ticked' : 'app_history_unticked',
                    {
                      check: t(`app_check_${check}`),
                    },
                  )}
                </span>
              )}
              <span className="text-xs text-ink-muted">
                {entry.actor} ·{' '}
                {format.dateTime(new Date(entry.at), { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}

/**
 * One application in full, on its own page: everything the applicant gave, the facts held about their account, the registry and
 * sanctions lookups, the six checks, the decision, and the staff activity on it. A person marks it ready and a second person
 * approves, or either rejects with a reason. The server checks every step again. Once it is approved or rejected the page is
 * read-only and shows the outcome and, for a rejection, the reason the applicant was given.
 * @param props - The review props.
 * @param props.detail - The application and everything held about it.
 * @param props.actorId - The signed-in staff member, so the page can say who may approve.
 * @param props.production - Whether this is production, where the same person cannot mark ready and approve.
 * @returns The sections of the review.
 */
export function ApplicationReview(props: {
  detail: ApplicationDetail;
  actorId: string;
  production: boolean;
}) {
  const t = useTranslations('Staff');
  const [pending, startTransition] = React.useTransition();
  const { detail } = props;
  const { item } = detail;
  const run = (fn: () => Promise<unknown>) => {
    startTransition(async () => {
      await fn();
    });
  };

  return (
    <div className="grid gap-8">
      <PageSection title={t('app_section_organisation')}>
        <Organisation item={item} />
      </PageSection>
      <PageSection title={t('app_section_applicant')}>
        <Applicant detail={detail} />
      </PageSection>
      <PageSection title={t('app_section_submission')}>
        <Submission detail={detail} />
      </PageSection>
      <PageSection title={t('app_section_lookups')}>
        <Lookups item={item} pending={pending} run={run} />
      </PageSection>
      <PageSection title={t('app_checks')}>
        <Checks item={item} pending={pending} run={run} />
      </PageSection>
      <PageSection title={t('app_section_decision')}>
        {item.status === 'in_review' ? (
          <Decision
            item={item}
            actorId={props.actorId}
            production={props.production}
            pending={pending}
            run={run}
          />
        ) : (
          <Decided item={item} />
        )}
      </PageSection>
      <PageSection title={t('app_section_history')}>
        <History detail={detail} />
      </PageSection>
    </div>
  );
}
