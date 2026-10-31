import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NextIntlClientProvider } from 'next-intl';
import { PageSection } from '@/components/layout/PageSection';
import { CaseDataTable } from '@/components/overview/CaseDataTable';
import { StatCard } from '@/components/overview/StatCard';
import { Card, CardContent } from '@/components/ui/card';
import { Timeline, TimelineItem } from '@/components/ui/timeline';
import messages from '@/locales/en.json';
import type { CaseRow } from '@/utils/cases/Case';

// Fixtures for this design catalogue only. The app never imports them: every screen reads the database.
const storyCases: CaseRow[] = [
  {
    id: 'a',
    number: 'CB-0001',
    name: 'Platform A',
    jurisdictions: 1,
    operators: [],
    claimants: 12,
    confirmed: 5,
    description: null,
    status: 'sealed',
    hasReport: true,
    updatedAt: '2026-10-26T08:41:00Z',
  },
  {
    id: 'b',
    number: 'CB-0002',
    name: 'Platform B',
    jurisdictions: 3,
    operators: [],
    claimants: 31,
    confirmed: 20,
    description: null,
    status: 'building',
    hasReport: false,
    updatedAt: '2026-10-25T09:12:00Z',
  },
  {
    id: 'c',
    number: 'CB-0003',
    name: 'Platform C',
    jurisdictions: 2,
    operators: [],
    claimants: 5,
    confirmed: 0,
    description: null,
    status: 'building',
    hasReport: false,
    updatedAt: '2026-10-24T10:30:00Z',
  },
];

function Patterns() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-12 p-8">
      <PageSection title="Stat cards" description="Card, CardDescription and CardValue only.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="New cases" value="12" hint="3 added this week" />
          <StatCard label="Open cases" value="4" hint="2 need a response" />
          <StatCard label="Claimants" value="187" hint="Across 3 cases" />
          <StatCard label="Sealed files" value="9" hint="2 sealed this month" />
        </div>
      </PageSection>

      <PageSection
        title="Data table"
        description="Sort, search, filter, column menu, selection and pagination."
      >
        <CaseDataTable cases={storyCases} />
      </PageSection>

      <PageSection title="Timeline" description="The marker carries the state by shape.">
        <Card>
          <CardContent>
            <Timeline>
              <TimelineItem marker="filled">Done or sealed</TimelineItem>
              <TimelineItem marker="dashed">The step you are on</TimelineItem>
              <TimelineItem marker="hollow">An event</TimelineItem>
              <TimelineItem marker="muted">Not yet</TimelineItem>
            </Timeline>
          </CardContent>
        </Card>
      </PageSection>
    </div>
  );
}

const meta = {
  title: 'Foundations/Patterns',
  component: Patterns,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <Story />
      </NextIntlClientProvider>
    ),
  ],
} satisfies Meta<typeof Patterns>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {};
