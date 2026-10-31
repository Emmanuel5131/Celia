'use client';

import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Button } from '@/components/ui/button';

/**
 * A small button that copies a value, such as a hash someone wants to check, and says so for a moment.
 * @param props - The button props.
 * @param props.value - What to copy.
 * @returns The button.
 */
export function CopyButton(props: { value: string }) {
  const t = useTranslations('Report');
  const [copied, setCopied] = React.useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => {
        void navigator.clipboard.writeText(props.value);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      }}
    >
      {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      <span className="sr-only">{copied ? t('copied') : t('copy_value')}</span>
    </Button>
  );
}
