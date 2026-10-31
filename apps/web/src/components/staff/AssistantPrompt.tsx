'use client';

import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Button } from '@/components/ui/button';

/**
 * The sentence staff give their assistant to run an approved plan, with a button to copy it. The assistant knows the rest from
 * Celia's own tools, so this is all staff need to say.
 * @param props - The prompt props.
 * @param props.text - The sentence to copy.
 * @returns The sentence and the button.
 */
export function AssistantPrompt(props: { text: string }) {
  const t = useTranslations('Staff');
  const [copied, setCopied] = React.useState(false);

  return (
    <div className="grid gap-4 border border-border bg-surface p-4">
      <p className="font-mono text-sm break-words">{props.text}</p>
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          void navigator.clipboard.writeText(props.text);
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
          }, 2000);
        }}
      >
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        {copied ? t('agent_copied') : t('agent_copy')}
      </Button>
    </div>
  );
}
