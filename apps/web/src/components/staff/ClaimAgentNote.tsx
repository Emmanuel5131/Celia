import { useFormatter, useTranslations } from 'next-intl';
import { PageSection } from '@/components/layout/PageSection';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ClaimAgentReview } from '@/libs/claims/AgentReview';

/**
 * What the assistant made of a claim: whether it picked it for a closer look, and its message to staff. It only advises; the
 * accept and reject buttons below it are the decision.
 * @param props - The note props.
 * @param props.review - The assistant's review of the claim.
 * @returns The section.
 */
export function ClaimAgentNote(props: { review: ClaimAgentReview }) {
  const t = useTranslations('StaffClaims');
  const format = useFormatter();

  return (
    <PageSection
      title={t('agent_note_title')}
      description={t('agent_note_text', {
        date: format.dateTime(new Date(props.review.reviewedAt), { dateStyle: 'medium' }),
      })}
    >
      <Card variant="outline">
        <CardContent className="grid gap-4">
          <Badge variant="muted" className="justify-self-start">
            {t(props.review.interesting ? 'agent_picked' : 'agent_not_picked')}
          </Badge>
          <p className="max-w-prose text-sm whitespace-pre-line">{props.review.message}</p>
        </CardContent>
      </Card>
    </PageSection>
  );
}
