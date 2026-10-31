import {
  CheckIcon,
  ClipboardTextIcon,
  FileMagnifyingGlassIcon,
  RobotIcon,
} from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';
import { PageSection } from '@/components/layout/PageSection';
import { Card, CardContent } from '@/components/ui/card';
import { Timeline, TimelineItem } from '@/components/ui/timeline';
import type { AnalysisStatus } from '@/utils/analysis/Status';

// Every step carries an icon, so the markers are the same size whatever the state and the text lines up.
const stepIcons = {
  plan: <ClipboardTextIcon aria-hidden="true" />,
  agent: <RobotIcon aria-hidden="true" />,
  review: <FileMagnifyingGlassIcon aria-hidden="true" />,
};

/**
 * The three steps of an analysis and where this case is on them, so staff always know what is theirs and what the agent does:
 * plan it, the agent runs it, review the report. The marker carries the state by shape: filled is done, dashed is the step to
 * take now, muted is not yet.
 * @param props - The steps props.
 * @param props.status - Where the case stands.
 * @returns The steps.
 */
export function CaseSteps(props: { status: AnalysisStatus }) {
  const t = useTranslations('Staff');
  const steps: { id: 'plan' | 'agent' | 'review'; marker: 'filled' | 'dashed' | 'muted' }[] = [
    { id: 'plan', marker: props.status === 'needs_plan' ? 'dashed' : 'filled' },
    {
      id: 'agent',
      marker: ({ needs_plan: 'muted', agent_working: 'dashed', report_saved: 'filled' } as const)[
        props.status
      ],
    },
    { id: 'review', marker: props.status === 'report_saved' ? 'dashed' : 'muted' },
  ];

  return (
    <PageSection title={t('steps_title')}>
      <Card variant="outline" size="sm">
        <CardContent>
          <Timeline>
            {steps.map((step) => (
              <TimelineItem
                key={step.id}
                marker={step.marker}
                icon={
                  step.marker === 'filled' ? <CheckIcon aria-hidden="true" /> : stepIcons[step.id]
                }
              >
                <p className="text-sm font-medium">{t(`step_${step.id}_title`)}</p>
                <p className="text-sm text-ink-muted">{t(`step_${step.id}_text`)}</p>
              </TimelineItem>
            ))}
          </Timeline>
        </CardContent>
      </Card>
    </PageSection>
  );
}
