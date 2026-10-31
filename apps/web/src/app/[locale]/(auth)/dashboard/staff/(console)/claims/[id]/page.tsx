import { ArrowLeftIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClaimAgentNote } from '@/components/staff/ClaimAgentNote';
import { ClaimDetails } from '@/components/staff/ClaimDetails';
import { ClaimFollowUp } from '@/components/staff/ClaimFollowUp';
import { ClaimReview } from '@/components/staff/ClaimReview';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/libs/accounts/Staff';
import { listAgentReviews } from '@/libs/claims/AgentReview';
import { readFollowUp } from '@/libs/claims/FollowUp';
import { getClaimRecord, listClaimsByPerson } from '@/libs/claims/StaffClaims';
import { Link } from '@/libs/I18nNavigation';

type StaffClaimPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: StaffClaimPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'StaffClaims' });

  return { title: t('page_title') };
}

export default async function StaffClaimPage(props: StaffClaimPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'StaffClaims' });
  await requireStaff();
  const record = z.uuid().safeParse(id).success ? await getClaimRecord(id) : null;

  if (!record) {
    notFound();
  }

  const others = await listClaimsByPerson(record.userId, record.id);
  const agentReviews = await listAgentReviews([record.id]);
  const agentReview = agentReviews.get(record.id);
  const waiting = record.state === 'sent' || record.state === 'in_review';
  const followUp = await readFollowUp(record.id);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3 justify-self-start">
        <Link href={waiting ? '/dashboard/staff/claims' : '/dashboard/staff/claims?view=all'}>
          <ArrowLeftIcon aria-hidden="true" />
          {t('back')}
        </Link>
      </Button>
      <PageHeader title={record.platformName ?? t('detail_unnamed')} description={record.id} />
      {agentReview && waiting && <ClaimAgentNote review={agentReview} />}
      <ClaimDetails record={record} others={others} />
      {followUp && <ClaimFollowUp followUp={followUp} />}
      {record.state !== 'draft' && <ClaimReview record={record} />}
    </>
  );
}
