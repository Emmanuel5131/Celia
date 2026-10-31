'use client';

import { useFormatter, useTranslations } from 'next-intl';
import * as React from 'react';
import { decideContactRequest } from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { Markdown } from '@/components/layout/Markdown';
import { PageSection } from '@/components/layout/PageSection';
import { ContactRequestStatusBadge } from '@/components/staff/ContactRequestStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { getForStaff } from '@/libs/contact/ContactRequests';
import { useRouter } from '@/libs/I18nNavigation';

type Request = NonNullable<Awaited<ReturnType<typeof getForStaff>>>;

function Fact(props: { label: string; children?: React.ReactNode }) {
  const t = useTranslations('Staff');

  return (
    <div className="grid gap-1">
      <dt className="text-xs text-ink-muted">{props.label}</dt>
      <dd className="text-sm break-words">
        {props.children ?? <span className="text-ink-muted">{t('app_none')}</span>}
      </dd>
    </div>
  );
}

function Details(props: { request: Request }) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const { request } = props;

  return (
    <Card variant="outline">
      <CardContent>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Fact label={t('cr_org')}>{request.organisation}</Fact>
          <Fact label={t('cr_case')}>{request.caseName}</Fact>
          <Fact label={t('cr_role')}>{request.askerRole}</Fact>
          <Fact label={t('cr_purpose')}>
            {request.purpose &&
              (request.purpose === 'other' && request.purposeOther
                ? request.purposeOther
                : t(`cr_purpose_${request.purpose}`))}
          </Fact>
          <Fact label={t('cr_reason')}>{request.reason}</Fact>
          <Fact label={t('cr_sent')}>
            {request.submittedAt &&
              format.dateTime(request.submittedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          </Fact>
        </dl>
      </CardContent>
    </Card>
  );
}

function Assistant(props: { review: NonNullable<Request['agentReview']> }) {
  const t = useTranslations('Staff');

  return (
    <div className="grid gap-2 text-sm">
      <Badge
        variant={props.review.verdict === 'pass' ? 'muted' : 'seal'}
        className="justify-self-start"
      >
        {t(`cr_verdict_${props.review.verdict}`)}
      </Badge>
      <p className="max-w-prose">{props.review.message}</p>
    </div>
  );
}

function Answers(props: { request: Request }) {
  const t = useTranslations('Staff');
  const { request } = props;

  return (
    <Card variant="outline">
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Fact label={t('cr_asked')}>{String(request.asked)}</Fact>
          <Fact label={t('cr_accepted')}>{String(request.accepted)}</Fact>
          <Fact label={t('cr_declined')}>{String(request.declined)}</Fact>
        </dl>
      </CardContent>
    </Card>
  );
}

function Decision(props: { request: Request }) {
  const t = useTranslations('Staff');
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [refusing, setRefusing] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [message, setMessage] = React.useState<'note' | 'state' | null>(null);
  const decide = (approve: boolean) => {
    startTransition(async () => {
      const result = await decideContactRequest({
        requestId: props.request.id,
        approve,
        note,
      });

      setMessage(result === 'ok' ? null : result);

      if (result === 'ok') {
        router.push('/dashboard/staff/contact-requests');
      }
    });
  };

  return (
    <div className="grid gap-3">
      {message && (
        <p role="alert" className="text-seal">
          {t(`cr_refusal_${message}`)}
        </p>
      )}
      <p className="text-sm text-ink-muted">{t('cr_approve_hint')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            decide(true);
          }}
        >
          {t('cr_approve')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setRefusing(!refusing);
          }}
        >
          {t('cr_reject')}
        </Button>
      </div>
      {refusing && (
        <div className="grid gap-2">
          <Label htmlFor="contact-refusal">{t('cr_reject_note')}</Label>
          <Textarea
            id="contact-refusal"
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
            disabled={pending || note.trim() === ''}
            onClick={() => {
              decide(false);
            }}
          >
            {t('cr_reject_confirm')}
          </Button>
        </div>
      )}
    </div>
  );
}

function Decided(props: { request: Request }) {
  const t = useTranslations('Staff');
  const format = useFormatter();
  const { request } = props;

  return (
    <Card variant="outline">
      <CardContent>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Fact label={t('cr_outcome')}>
            <ContactRequestStatusBadge status={request.status} />
          </Fact>
          <Fact label={t('cr_decided_on')}>
            {request.decidedAt &&
              format.dateTime(request.decidedAt, { dateStyle: 'medium', timeStyle: 'short' })}
          </Fact>
          {request.status === 'rejected' && (
            <Fact label={t('cr_decision_note')}>{request.decisionNote}</Fact>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

/**
 * One request to contact the claimants of a case, in full: who asks and why, the email claimants would read, the assistant's
 * note when there is one, and the decision. A request still waiting can be approved,
 * which asks the claimants who agreed to be contacted, or refused with a reason the organisation reads. Once decided the page is
 * read-only and shows how claimants have answered.
 * @param props - The review props.
 * @param props.request - The request and everything held about it.
 * @returns The sections of the review.
 */
export function ContactRequestReview(props: { request: Request }) {
  const t = useTranslations('Staff');
  const { request } = props;
  const waiting = request.status === 'submitted' || request.status === 'agent_reviewed';

  return (
    <div className="grid gap-8">
      <PageSection title={t('cr_section_request')}>
        <Details request={request} />
      </PageSection>
      <PageSection title={t('cr_section_message')}>
        <Card variant="outline">
          <CardContent>{request.message && <Markdown>{request.message}</Markdown>}</CardContent>
        </Card>
      </PageSection>
      {request.agentReview && (
        <PageSection title={t('cr_section_assistant')}>
          <Assistant review={request.agentReview} />
        </PageSection>
      )}
      <PageSection title={t('cr_section_decision')}>
        {waiting ? <Decision request={request} /> : <Decided request={request} />}
      </PageSection>
      {request.status === 'approved' && (
        <PageSection title={t('cr_section_answers')}>
          <Answers request={request} />
        </PageSection>
      )}
    </div>
  );
}
