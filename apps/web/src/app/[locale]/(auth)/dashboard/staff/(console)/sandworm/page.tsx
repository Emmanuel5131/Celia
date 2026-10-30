import { CheckCircleIcon, PlugsConnectedIcon, WarningCircleIcon } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/layout/PageHeader';
import { SandwormConnection } from '@/components/staff/SandwormConnection';
import { SandwormRules } from '@/components/staff/SandwormRules';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { requireStaff } from '@/libs/accounts/Staff';
import { Env } from '@/libs/Env';
import { connectedSince, lastSandwormCall, sandwormSetUp } from '@/libs/sandworm/Connection';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sandworm?: string }>;
};

const results = ['connected', 'refused', 'failed'] as const;

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Staff' });

  return {
    title: t('sandworm_title'),
  };
}

export default async function StaffSandwormPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Staff' });
  const staff = await requireStaff();
  const { sandworm } = await props.searchParams;
  const result = results.find((value) => value === sandworm);
  const setUp = sandwormSetUp();
  const [connectedAt, lastCallAt] = setUp
    ? await Promise.all([connectedSince(staff.id), lastSandwormCall(staff.id)])
    : [null, null];

  return (
    <>
      <PageHeader title={t('sandworm_title')} description={t('sandworm_description')} />
      <div className="grid gap-8">
        {result && (
          <Card size="sm">
            <output className="flex items-center gap-2 px-(--card-spacing) text-sm">
              {result === 'connected' ? (
                <CheckCircleIcon aria-hidden="true" />
              ) : (
                <WarningCircleIcon aria-hidden="true" />
              )}
              {t(`sandworm_result_${result}`)}
            </output>
          </Card>
        )}
        {setUp ? (
          <SandwormConnection
            connectedAt={connectedAt?.toISOString() ?? null}
            lastCallAt={lastCallAt?.toISOString() ?? null}
            workspaceId={Env.SANDWORM_WORKSPACE_ID ?? null}
          />
        ) : (
          <Empty className="border border-border bg-surface">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PlugsConnectedIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t('sandworm_not_set_up_title')}</EmptyTitle>
              <EmptyDescription>{t('sandworm_not_set_up')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        <SandwormRules />
      </div>
    </>
  );
}
