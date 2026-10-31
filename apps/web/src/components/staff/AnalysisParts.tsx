'use client';

import { analysisTemplates, confirmedClaimsToBuild, getChain, statementKinds } from '@celia/core';
import type { Brief, PreflightProblem } from '@celia/core';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import {
  addPlatformStatement,
  updatePlatformStatement,
} from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { useCloseAddDialog } from '@/components/staff/AddDialog';
import { useConfirmedTransition } from '@/components/staff/ConfirmAction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { maxStatements } from '@/validations/StatementValidation';

/**
 * What is still missing before the plan can be approved, in plain words, and below it anything staff should know. Nothing shows
 * when there is nothing to say.
 * @param props - The list props.
 * @param props.problems - The preflight problems.
 * @param props.title - The heading over what is missing, when it should not be the usual one.
 * @returns The lists, or nothing.
 */
export function AnalysisProblems(props: { problems: PreflightProblem[]; title?: string }) {
  const t = useTranslations('Staff');
  const missing = props.problems.filter((problem) => problem.blocking);
  const notes = props.problems.filter((problem) => !problem.blocking);

  const list = (items: PreflightProblem[], className?: string) => (
    <ul className={`grid list-disc gap-1 pl-5 text-sm ${className ?? ''}`}>
      {items.map((problem) => (
        <li key={problem.code}>
          {t(`brief_problem_${problem.code}`, { count: confirmedClaimsToBuild })}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      {missing.length > 0 && (
        <section className="grid gap-2">
          <h3 className="text-base font-medium">{props.title ?? t('plan_missing_title')}</h3>
          {list(missing)}
        </section>
      )}
      {notes.length > 0 && (
        <section className="grid gap-2">
          <h3 className="text-base font-medium">{t('plan_notes_title')}</h3>
          {list(notes, 'text-ink-muted')}
        </section>
      )}
    </>
  );
}

/**
 * The form that adds a statement the platform made in public, with where it said it. Each statement is researched on its own, so
 * adding one adds a row to the case's research list.
 * @param props - The form props.
 * @param props.caseId - The case id.
 * @param props.statement - A statement to change, instead of adding a new one.
 * @returns The form.
 */
export function StatementForm(props: {
  caseId: string;
  statement?: { id: string; text: string; sourceUrl: string; kind: string };
}) {
  const close = useCloseAddDialog();
  const t = useTranslations('Staff');
  const [errors, setErrors] = React.useState<string[]>([]);
  const { pending, startTransition, dialog } = useConfirmedTransition();

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);

        // The topic decides which test answers the statement, so it is never guessed: staff choose it.
        if (!data.get('kind')) {
          setErrors(['kind']);

          return;
        }

        startTransition(async () => {
          const result = props.statement
            ? await updatePlatformStatement(props.caseId, props.statement.id, data)
            : await addPlatformStatement(props.caseId, data);
          setErrors(result);

          if (result.length === 0) {
            form.reset();
            close();
          }
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="statement-text">{t('statements_text_label')}</Label>
        <Textarea
          id="statement-text"
          name="text"
          rows={3}
          maxLength={500}
          placeholder={t('statements_example')}
          defaultValue={props.statement?.text}
          aria-invalid={errors.includes('invalid') || errors.includes('words')}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="statement-url">{t('statements_url_label')}</Label>
        <Input
          id="statement-url"
          name="sourceUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          defaultValue={props.statement?.sourceUrl}
          aria-invalid={errors.includes('invalid')}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="statement-kind">{t('statements_kind_label')}</Label>
        <Select name="kind" defaultValue={props.statement?.kind}>
          <SelectTrigger id="statement-kind" aria-invalid={errors.includes('kind')}>
            <SelectValue placeholder={t('statements_kind_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {statementKinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(`statements_kind_${kind}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {errors.length > 0 && (
        <p role="alert" className="text-sm text-seal">
          {errors.includes('kind') && t('statements_error_kind')}
          {errors.includes('invalid') && t('statements_error_invalid')}
          {errors.includes('words') && t('statements_error_words')}
          {errors.includes('full') && t('statements_error_full', { max: maxStatements })}
          {errors.includes('researched') && t('statements_error_researched')}
        </p>
      )}
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>
        {t(props.statement ? 'save' : 'statements_add')}
      </Button>
      {dialog}
    </form>
  );
}

function Fact(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-ink-muted">{props.label}</dt>
      <dd className="text-sm">{props.children}</dd>
    </div>
  );
}

/**
 * The brief as Celia would send it: the template, the window, the chains, the platform's addresses and what each test backs. The
 * addresses are the platform's, never a claimant's, and staff read them before they approve.
 * @param props - The summary props.
 * @param props.brief - The brief.
 * @returns The summary.
 */
export function AnalysisBriefSummary(props: { brief: Brief }) {
  const t = useTranslations('Staff');
  const { brief } = props;
  const addresses = [...brief.receivingAddresses, ...brief.tokenContracts];
  const titles = new Map<string, string>(
    analysisTemplates[brief.template.id].tests.map((test) => [test.id, test.title]),
  );

  return (
    <section className="grid gap-4">
      <h3 className="text-base font-medium">{t('brief_summary_title')}</h3>
      <dl className="grid gap-4">
        <Fact label={t('brief_field_template')}>
          <span className="font-mono">
            {brief.template.id} {brief.template.version}
          </span>
        </Fact>
        <Fact label={t('brief_field_window')}>
          <span className="font-mono">
            {brief.window.from} → {brief.window.to}
          </span>
        </Fact>
        <Fact label={t('brief_field_chains')}>
          {brief.chains.map((chain) => getChain(chain).name).join(', ')}
        </Fact>
        <Fact label={t('brief_field_addresses')}>
          <ul className="grid gap-1">
            {addresses.map((item) => (
              <li key={`${item.chain}-${item.address}`} className="font-mono text-xs break-all">
                {getChain(item.chain).name} · {item.address}
              </li>
            ))}
          </ul>
        </Fact>
        <Fact label={t('brief_field_tests')}>
          <ul className="grid gap-1">
            {brief.tests.map((test) => (
              <li key={test.id}>
                {titles.get(test.id) ?? test.id}
                {test.statements.length > 0 &&
                  ` · ${t('brief_tests_line', { count: test.statements.length })}`}
              </li>
            ))}
          </ul>
        </Fact>
        {brief.skippedChains.length > 0 && (
          <Fact label={t('brief_field_skipped')}>
            {brief.skippedChains.map((chain) => getChain(chain).name).join(', ')}
          </Fact>
        )}
      </dl>
    </section>
  );
}
