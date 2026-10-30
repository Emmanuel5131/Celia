import { useTranslations } from 'next-intl';
import { PageSection } from '@/components/layout/PageSection';
import { SettingsList, SettingsRow } from '@/components/layout/SettingsList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';

/**
 * What limits a Sandworm connection, shown before someone connects as well as after, so they know what they are approving. The
 * rows are policy, not options: each says "always on" instead of offering a switch.
 * @returns The section.
 */
export function SandwormRules() {
  const t = useTranslations('Staff');

  return (
    <PageSection title={t('sandworm_rules_title')} description={t('sandworm_rules_description')}>
      <SettingsList>
        <SettingsRow
          title={t('sandworm_rule_workspace_title')}
          description={t('sandworm_rule_workspace_text')}
        >
          <Badge variant="muted">{t('sandworm_always_on')}</Badge>
        </SettingsRow>
        <SettingsRow
          title={t('sandworm_rule_wallets_title')}
          description={t('sandworm_rule_wallets_text')}
        >
          <Badge variant="muted">{t('sandworm_always_on')}</Badge>
        </SettingsRow>
        <SettingsRow
          title={t('sandworm_rule_audit_title')}
          description={t('sandworm_rule_audit_text')}
        >
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/staff/activity">{t('sandworm_view_activity')}</Link>
          </Button>
        </SettingsRow>
      </SettingsList>
    </PageSection>
  );
}
