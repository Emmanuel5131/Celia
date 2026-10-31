import { canSignInBrowser, canVerifyOwnership, ownershipMessage, signingTool } from '@celia/core';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as z from 'zod';
import {
  deleteClaim,
  removeFollowUpDetails,
  removeOwnershipEvidence,
  saveFollowUpDetails,
  saveStatement,
  sendOwnershipProof,
  sendOwnershipVideo,
  submitClaim,
  verifyClaimOwnership,
  withdrawOwnershipReview,
} from '@/app/[locale]/(auth)/dashboard/claims/actions';
import { OperatorName } from '@/components/claims/ClaimMeta';
import { ClaimSummary } from '@/components/claims/ClaimSummary';
import { ClaimWizard } from '@/components/claims/ClaimWizard';
import type { WizardKey } from '@/components/claims/ClaimWizard';
import { DeleteClaimDialog } from '@/components/claims/DeleteClaimDialog';
import { FollowUpCard } from '@/components/claims/FollowUpCard';
import { OwnershipCard } from '@/components/claims/OwnershipCard';
import { StatementCard } from '@/components/claims/StatementCard';
import { SubmitClaimCard } from '@/components/claims/SubmitClaimCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { sentAfterSeal } from '@/libs/cases/Cases';
import { listClaimExtras } from '@/libs/claims/ClaimExtras';
import { listProofFiles } from '@/libs/claims/ClaimProofs';
import { countOthersOnOperator, getClaim } from '@/libs/claims/Claims';
import { readFollowUp } from '@/libs/claims/FollowUp';
import { Link } from '@/libs/I18nNavigation';
import { claimSteps } from '@/utils/claims/ClaimSteps';

type ClaimPageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ edit?: string }>;
};

export async function generateMetadata(props: ClaimPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'ClaimPage' });

  return {
    title: t('meta_title_detail'),
    description: t('meta_description_detail'),
  };
}

export default async function ClaimPage(props: ClaimPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'ClaimPage' });
  const { userId } = await auth();
  const { edit } = await props.searchParams;

  // A claim that is not yours looks the same as one that does not exist.
  const claim = z.uuid().safeParse(id).success && userId ? await getClaim(userId, id) : undefined;

  if (!claim) {
    notFound();
  }

  const { chain } = claim;
  const others = await countOthersOnOperator(claim);
  const canSign = claim.paymentMethod === 'wallet' && claim.walletAddress !== null;
  const message = canSign
    ? ownershipMessage({ chain, address: claim.walletAddress ?? '', nonce: claim.nonce })
    : '';

  const draft = claim.status !== 'submitted';
  const files = canSign ? await listProofFiles(claim.id) : [];
  const panels: { key: WizardKey; panel: React.ReactNode; action?: React.ReactNode }[] = [
    ...(canSign
      ? [
          {
            key: 'ownership' as const,
            panel: (
              <OwnershipCard
                claimId={claim.id}
                chain={chain}
                address={claim.walletAddress ?? ''}
                message={message}
                method={claim.ownershipMethod}
                signed={claim.signature !== null}
                waiting={claim.reviewRequestedAt !== null && claim.reviewedAt === null}
                reviewNote={claim.reviewNote}
                videoUrl={claim.reviewVideoUrl}
                files={files}
                canVerify={canVerifyOwnership(chain)}
                inBrowser={canSignInBrowser(chain)}
                tool={signingTool(chain)}
                verify={verifyClaimOwnership.bind(null, claim.id)}
                sendProof={sendOwnershipProof.bind(null, claim.id)}
                sendVideo={sendOwnershipVideo.bind(null, claim.id)}
                withdraw={withdrawOwnershipReview.bind(null, claim.id)}
                remove={removeOwnershipEvidence.bind(null, claim.id)}
              />
            ),
          },
        ]
      : []),
    {
      key: 'statement',
      panel: (
        <StatementCard
          statement={claim.statement}
          fraudType={claim.fraudType}
          action={saveStatement.bind(null, claim.id)}
        />
      ),
    },
    {
      key: 'send',
      panel: (
        <div className="grid gap-6">
          <SubmitClaimCard
            sent={!draft}
            ready={Boolean(claim.statement)}
            others={others}
            late={await sentAfterSeal(claim)}
            platform={claim.platformName}
            action={submitClaim.bind(null, claim.id)}
          />
          {!draft && (
            <FollowUpCard
              saved={await readFollowUp(claim.id)}
              action={saveFollowUpDetails.bind(null, claim.id)}
              remove={removeFollowUpDetails.bind(null, claim.id)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <ClaimWizard
      // A new key reopens the wizard on the account when Edit account is pressed on a page that is already open.
      key={edit ?? 'steps'}
      start={edit === 'account' ? 'statement' : undefined}
      header={
        <PageHeader
          title={<OperatorName name={claim.platformName} />}
          description={
            claim.platformName
              ? t('others', { count: others, platform: claim.platformName })
              : t('others_unnamed', { count: others })
          }
        />
      }
      panels={panels}
      states={claimSteps(claim)}
      aside={
        <ClaimSummary
          claim={claim}
          extras={await listClaimExtras(claim.id)}
          footer={
            draft ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/claims/${claim.id}/edit`}>{t('edit_action')}</Link>
                </Button>
                <DeleteClaimDialog action={deleteClaim.bind(null, claim.id)} />
              </>
            ) : (
              // A sent claim can still be edited: the details, with a change sending it back for review, and the person's own account.
              <>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/claims/${claim.id}/edit`}>{t('edit_action')}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/claims/${claim.id}?edit=account`}>
                    {t('edit_account_action')}
                  </Link>
                </Button>
              </>
            )
          }
        />
      }
    />
  );
}
