import { CheckIcon, MinusIcon, QuestionIcon, XIcon } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { CheckResult } from '@/validations/ReportValidation';

// Each result has its own shape as well as its label, so the result never rests on colour alone.
const resultTags = {
  proven: { variant: 'solid', Icon: CheckIcon },
  proven_false: { variant: 'solid', Icon: XIcon },
  partly_proven: { variant: 'default', Icon: MinusIcon },
  not_proven: { variant: 'dashed', Icon: XIcon },
  not_checkable: { variant: 'muted', Icon: QuestionIcon },
} as const;

/**
 * A check's result as a tag: filled with a tick = proven, filled with a cross = proven false, outlined with a dash = partly proven,
 * dashed = not proven, plain = the chain cannot show it.
 * @param props - The tag props.
 * @param props.result - The result.
 * @returns The tag.
 */
export function ResultBadge(props: { result: CheckResult }) {
  const t = useTranslations('Report');
  const { variant, Icon } = resultTags[props.result];

  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {t(`result_${props.result}`)}
    </Badge>
  );
}
