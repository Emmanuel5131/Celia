import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClaimRegister } from '@/components/staff/ClaimRegister';
import { ClaimsTable } from '@/components/staff/ClaimsTable';
import { PlatformsTable } from '@/components/staff/PlatformsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listClaimsToValidate, requireStaff } from '@/libs/accounts/Staff';
import { staffCounts } from '@/libs/accounts/StaffCounts';
import { withAgentReviews } from '@/libs/claims/AgentReview';
import { listClaimRegister } from '@/libs/claims/StaffClaims';
import { listPlatforms } from '@/libs/claims/StaffPlatforms';
import { Link } from '@/libs/I18nNavigation';
import { registerStates } from '@/utils/claims/ClaimRegister';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function ReviewQueue() {
  const [items, counts] = await Promise.all([listClaimsToValidate(), staffCounts()]);

  return <ClaimsTable items={await withAgentReviews(items)} total={counts.claims} />;
}

async function AgentPicks() {
  const reviewed = await withAgentReviews(await listClaimsToValidate());
  const picked = reviewed.filter((item) => item.agentReview);

  return <ClaimsTable items={picked} total={picked.length} />;
}

async function Platforms() {
  return <PlatformsTable items={await listPlatforms()} />;
}

async function AllClaims(props: { query: Record<string, string | string[] | undefined> }) {
  const status = registerStates.find((state) => state === first(props.query.status)) ?? 'all';
  const search = first(props.query.q) ?? '';
  const page = Math.max(1, Math.trunc(Number(first(props.query.page) ?? '1')) || 1);
  const { records, total } = await listClaimRegister({
    state: status,
    search,
    page,
  });

  return (
    <ClaimRegister records={records} total={total} page={page} state={status} search={search} />
  );
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return {
    title: t('validate_title'),
  };
}

export default async function StaffClaimsPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  const register = await getTranslations({ locale, namespace: 'StaffClaims' });
  await requireStaff();
  const query = await props.searchParams;
  const requested = first(query.view);
  const view =
    requested === 'all' || requested === 'platform' || requested === 'agent' ? requested : 'review';
  const headerFor = (current: typeof view) => {
    if (current === 'all') {
      return { title: register('register_tab_all'), description: register('register_description') };
    }

    if (current === 'agent') {
      return { title: register('agent_tab'), description: register('agent_description') };
    }

    if (current === 'platform') {
      return { title: register('platforms_tab'), description: register('platforms_description') };
    }

    return { title: t('validate_title'), description: t('validate_description') };
  };
  const tabs = [
    {
      id: 'review',
      href: '/dashboard/staff/claims',
      label: register('register_tab_review'),
    },
    {
      id: 'agent',
      href: '/dashboard/staff/claims?view=agent',
      label: register('agent_tab'),
    },
    {
      id: 'all',
      href: '/dashboard/staff/claims?view=all',
      label: register('register_tab_all'),
    },
    {
      id: 'platform',
      href: '/dashboard/staff/claims?view=platform',
      label: register('platforms_tab'),
    },
  ] as const;

  return (
    <>
      <PageHeader title={headerFor(view).title} description={headerFor(view).description} />
      <Tabs value={view}>
        <TabsList aria-label={t('validate_title')}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} asChild>
              <Link href={tab.href}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={view}>
          {view === 'all' && <AllClaims query={query} />}
          {view === 'platform' && <Platforms />}
          {view === 'review' && <ReviewQueue />}
          {view === 'agent' && <AgentPicks />}
        </TabsContent>
      </Tabs>
    </>
  );
}
