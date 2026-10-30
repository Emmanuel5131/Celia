import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClaimRegister } from '@/components/staff/ClaimRegister';
import { ClaimsTable } from '@/components/staff/ClaimsTable';
import { Button } from '@/components/ui/button';
import { listClaimsToValidate, requireStaff } from '@/libs/accounts/Staff';
import { staffCounts } from '@/libs/accounts/StaffCounts';
import { listClaimRegister } from '@/libs/claims/StaffClaims';
import { Link } from '@/libs/I18nNavigation';
import { registerStates } from '@/utils/claims/ClaimRegister';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function ReviewQueue() {
  const [items, counts] = await Promise.all([listClaimsToValidate(), staffCounts()]);

  return <ClaimsTable items={items} total={counts.claims} />;
}

async function AllClaims(props: { query: Record<string, string | string[] | undefined> }) {
  const status = registerStates.find((state) => state === first(props.query.status)) ?? 'all';
  const search = first(props.query.q) ?? '';
  const page = Math.max(1, Math.trunc(Number(first(props.query.page) ?? '1')) || 1);
  const { records, total } = await listClaimRegister({ state: status, search, page });

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
  const all = first(query.view) === 'all';
  const tabs = [
    { id: 'review', href: '/dashboard/staff/claims', label: register('register_tab_review') },
    { id: 'all', href: '/dashboard/staff/claims?view=all', label: register('register_tab_all') },
  ] as const;

  return (
    <>
      <PageHeader
        title={all ? register('register_tab_all') : t('validate_title')}
        description={all ? register('register_description') : t('validate_description')}
      />
      <nav aria-label={t('validate_title')} className="flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            asChild
            size="sm"
            variant={(tab.id === 'all') === all ? 'default' : 'outline'}
          >
            <Link href={tab.href}>{tab.label}</Link>
          </Button>
        ))}
      </nav>
      {all ? <AllClaims query={query} /> : <ReviewQueue />}
    </>
  );
}
