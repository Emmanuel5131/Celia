'use client';

import {
  chains,
  evidenceFileTypes,
  evidenceTypes,
  isAnalysisType,
  isEvidenceFileType,
  isReferenceType,
  maxEvidenceFileBytes,
  sourceOf,
} from '@celia/core';
import type { EvidenceSource, EvidenceType } from '@celia/core';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import * as z from 'zod';
import {
  addCaseEvidence,
  startEvidenceUpload,
  updateCaseEvidence,
} from '@/app/[locale]/(auth)/dashboard/staff/actions';
import { useCloseAddDialog } from '@/components/staff/AddDialog';
import { useConfirmedTransition } from '@/components/staff/ConfirmAction';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import type { CaseEvidence } from '@/libs/analysis/Evidence';
import { maxEvidence } from '@/validations/EvidenceValidation';

const fileTypes = new Set<EvidenceType>(Object.values(evidenceFileTypes));
const accept = Object.keys(evidenceFileTypes).join(',');

const Uploaded = z.object({ data: z.object({ id: z.string() }) });

/**
 * Sends the file straight from the browser to IPFS through Pinata, with an address our server signed for it, so the file never
 * passes through our server or database.
 * @param file - The file to upload.
 * @returns Pinata's id for the pinned file, or the reason there is none.
 */
async function uploadFile(file: File): Promise<{ id: string } | { error: string }> {
  const signed = await startEvidenceUpload(file.name);

  if (signed.url === undefined) {
    return { error: signed.error ?? 'failed' };
  }

  const body = new FormData();
  body.set('network', 'public');
  body.set('file', file);
  const response = await fetch(signed.url, { method: 'POST', body });
  const parsed = Uploaded.safeParse(response.ok ? await response.json() : null);

  return parsed.success ? { id: parsed.data.data.id } : { error: 'failed' };
}

function ChainFields(props: {
  type: EvidenceType;
  invalid: boolean;
  chain?: string | null;
  reference?: string | null;
}) {
  const t = useTranslations('Staff');

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="evidence-chain">{t('evidence_chain_label')}</Label>
        <Select name="chain" defaultValue={props.chain ?? undefined}>
          <SelectTrigger id="evidence-chain" aria-invalid={props.invalid}>
            <SelectValue placeholder={t('evidence_chain_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {chains.map((chain) => (
              <SelectItem key={chain.id} value={chain.id}>
                {chain.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="evidence-reference">
          {t(props.type === 'wallet' ? 'evidence_wallet_label' : 'evidence_transaction_label')}
        </Label>
        <Input
          id="evidence-reference"
          name="reference"
          maxLength={128}
          defaultValue={props.reference ?? undefined}
          className="font-mono"
          aria-invalid={props.invalid}
        />
      </div>
    </>
  );
}

const errorKeys = [
  'type',
  'invalid',
  'action',
  'missing',
  'words',
  'file',
  'statement',
  'taken',
  'off',
  'failed',
  'full',
] as const;

function EvidenceErrors(props: { errors: string[] }) {
  const t = useTranslations('Staff');
  const shown = errorKeys.filter((key) => props.errors.includes(key));

  return (
    shown.length > 0 && (
      <p role="alert" className="grid gap-1 text-sm text-seal">
        {shown.map((key) => (
          <span key={key}>{t(`evidence_error_${key}`, { max: maxEvidence })}</span>
        ))}
      </p>
    )
  );
}

/**
 * Checks the file against what was chosen, uploads it to IPFS when the type needs one, and adds the evidence.
 * @param options - What to save.
 * @param options.caseId - The case id.
 * @param options.type - The chosen type.
 * @param options.data - The form fields, without the file.
 * @param options.file - The file field, if the type needs one.
 * @returns The names of what failed; none when added.
 */
async function saveEvidence(options: {
  caseId: string;
  type: EvidenceType;
  data: FormData;
  file: FormDataEntryValue | null;
}) {
  const { file } = options;

  if (fileTypes.has(options.type)) {
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > maxEvidenceFileBytes ||
      !isEvidenceFileType(file.type) ||
      evidenceFileTypes[file.type] !== options.type
    ) {
      return ['file'];
    }

    const uploaded = await uploadFile(file);

    if ('error' in uploaded) {
      return [uploaded.error];
    }

    options.data.set('pinId', uploaded.id);
  }

  return await addCaseEvidence(options.caseId, options.data);
}

/**
 * Where staff add evidence to a case: a video, picture or document, a link, or a wallet or transaction. Files go to IPFS through
 * Pinata and are public and permanent, so staff must confirm the material is public and lawful to show.
 * @param props - The form props.
 * @param props.caseId - The case id.
 * @param props.source - Limits the type list to one kind of evidence; leave it out to offer every type.
 * @param props.statements - The statements staff can link the evidence to.
 * @param props.actions - The alleged actions staff can attach the evidence to.
 * @returns The form.
 */
export function EvidenceForm(props: {
  caseId: string;
  source?: EvidenceSource;
  statements: { id: string; text: string }[];
  actions: { id: string; title: string }[];
}) {
  const close = useCloseAddDialog();
  const t = useTranslations('Staff');
  const [type, setType] = React.useState<EvidenceType | ''>('');
  const [lawful, setLawful] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const { pending, startTransition, dialog } = useConfirmedTransition();
  const needsFile = type !== '' && fileTypes.has(type);
  const reference = type !== '' && isReferenceType(type);

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const file = data.get('file');
        data.delete('file');
        data.set('type', type);
        data.set('lawful', lawful ? 'on' : '');

        if (!type) {
          setErrors(['type']);

          return;
        }

        startTransition(async () => {
          const result = await saveEvidence({ caseId: props.caseId, type, data, file });
          setErrors(result);

          if (result.length === 0) {
            form.reset();
            setType('');
            setLawful(false);
            close();
          }
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="evidence-type">{t('evidence_type_label')}</Label>
        <Select
          value={type}
          onValueChange={(next) => {
            setType(
              evidenceTypes.find(
                (value) => value === next && (!props.source || sourceOf(value) === props.source),
              ) ?? '',
            );
          }}
        >
          <SelectTrigger id="evidence-type" aria-invalid={errors.includes('type')}>
            <SelectValue placeholder={t('evidence_type_placeholder')} />
          </SelectTrigger>
          <SelectContent>
            {evidenceTypes
              .filter((value) => !props.source || sourceOf(value) === props.source)
              .map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`evidence_source_${sourceOf(value)}`)} · {t(`evidence_type_${value}`)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="evidence-title">{t('evidence_title_label')}</Label>
        <Input
          id="evidence-title"
          name="title"
          maxLength={120}
          aria-invalid={errors.includes('invalid')}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="evidence-note">{t('evidence_note_label')}</Label>
        <Textarea
          id="evidence-note"
          name="note"
          rows={3}
          maxLength={500}
          aria-invalid={errors.includes('words')}
        />
      </div>
      {needsFile && (
        <div className="grid gap-2">
          <Label htmlFor="evidence-file">{t('evidence_file_label')}</Label>
          <Input
            id="evidence-file"
            name="file"
            type="file"
            accept={accept}
            aria-invalid={errors.includes('file')}
          />
          <p className="text-sm text-ink-muted">{t('evidence_file_hint')}</p>
        </div>
      )}
      {reference && <ChainFields type={type} invalid={errors.includes('invalid')} />}
      {!reference && (
        <div className="grid gap-2">
          <Label htmlFor="evidence-url">
            {t(
              type === 'link' || (type !== '' && isAnalysisType(type))
                ? 'evidence_url_label_link'
                : 'evidence_url_label',
            )}
          </Label>
          <Input
            id="evidence-url"
            name="sourceUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            aria-invalid={errors.includes('invalid')}
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="evidence-date">{t('evidence_date_label')}</Label>
        <Input id="evidence-date" name="capturedOn" type="date" />
      </div>
      {props.statements.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="evidence-statement">{t('evidence_statement_label')}</Label>
          <Select name="statementId">
            <SelectTrigger id="evidence-statement">
              <SelectValue placeholder={t('evidence_statement_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {props.statements.map((statement) => (
                <SelectItem key={statement.id} value={statement.id}>
                  {statement.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {props.actions.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="evidence-action">{t('evidence_action_label')}</Label>
          <Select name="actionId">
            <SelectTrigger id="evidence-action">
              <SelectValue placeholder={t('evidence_action_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {props.actions.map((action) => (
                <SelectItem key={action.id} value={action.id}>
                  {action.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-start gap-3">
        <Checkbox
          id="evidence-lawful"
          checked={lawful}
          aria-invalid={errors.includes('invalid') && !lawful}
          onCheckedChange={(next) => {
            setLawful(next === true);
          }}
        />
        <Label htmlFor="evidence-lawful" className="font-normal">
          {t('evidence_lawful_label')}
        </Label>
      </div>
      <EvidenceErrors errors={errors} />
      <Button type="submit" variant="outline" className="justify-self-start" disabled={pending}>
        {t(pending && needsFile ? 'evidence_uploading' : 'evidence_add')}
      </Button>
      {dialog}
    </form>
  );
}

/**
 * Where staff change evidence that is already on a case: its title, note, link, date, chain and reference, and the statement and
 * action it backs. What kind of evidence it is and its file cannot change, so the kind is shown and not asked.
 * @param props - The form props.
 * @param props.caseId - The case id.
 * @param props.item - The evidence to change.
 * @param props.statements - The statements staff can link the evidence to.
 * @param props.actions - The alleged actions staff can attach the evidence to.
 * @returns The form.
 */
export function EvidenceEditForm(props: {
  caseId: string;
  item: CaseEvidence;
  statements: { id: string; text: string }[];
  actions: { id: string; title: string }[];
}) {
  const close = useCloseAddDialog();
  const t = useTranslations('Staff');
  const [errors, setErrors] = React.useState<string[]>([]);
  const { pending, startTransition, dialog } = useConfirmedTransition();
  const { item } = props;
  const reference = isReferenceType(item.type);

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        data.set('type', item.type);

        startTransition(async () => {
          const result = await updateCaseEvidence(props.caseId, item.id, data);
          setErrors(result);

          if (result.length === 0) {
            close();
          }
        });
      }}
    >
      <p className="text-sm text-ink-muted">
        {t(`evidence_source_${item.source}`)} · {t(`evidence_type_${item.type}`)}
      </p>
      <div className="grid gap-2">
        <Label htmlFor="evidence-edit-title">{t('evidence_title_label')}</Label>
        <Input
          id="evidence-edit-title"
          name="title"
          maxLength={120}
          defaultValue={item.title}
          aria-invalid={errors.includes('invalid')}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="evidence-edit-note">{t('evidence_note_label')}</Label>
        <Textarea
          id="evidence-edit-note"
          name="note"
          rows={3}
          maxLength={500}
          defaultValue={item.note ?? undefined}
          aria-invalid={errors.includes('words')}
        />
      </div>
      {reference ? (
        <ChainFields
          type={item.type}
          invalid={errors.includes('invalid')}
          chain={item.chain}
          reference={item.reference}
        />
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="evidence-edit-url">{t('evidence_url_label_link')}</Label>
          <Input
            id="evidence-edit-url"
            name="sourceUrl"
            type="url"
            inputMode="url"
            placeholder="https://"
            defaultValue={item.sourceUrl ?? undefined}
            aria-invalid={errors.includes('invalid')}
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="evidence-edit-date">{t('evidence_date_label')}</Label>
        <Input
          id="evidence-edit-date"
          name="capturedOn"
          type="date"
          defaultValue={item.capturedOn ?? undefined}
        />
      </div>
      {props.statements.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="evidence-edit-statement">{t('evidence_statement_label')}</Label>
          <Select name="statementId" defaultValue={item.statementId ?? undefined}>
            <SelectTrigger id="evidence-edit-statement">
              <SelectValue placeholder={t('evidence_statement_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {props.statements.map((statement) => (
                <SelectItem key={statement.id} value={statement.id}>
                  {statement.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {props.actions.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="evidence-edit-action">{t('evidence_action_label')}</Label>
          <Select name="actionId" defaultValue={item.actionId ?? undefined}>
            <SelectTrigger id="evidence-edit-action">
              <SelectValue placeholder={t('evidence_action_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {props.actions.map((action) => (
                <SelectItem key={action.id} value={action.id}>
                  {action.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <EvidenceErrors errors={errors} />
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {t('save')}
      </Button>
      {dialog}
    </form>
  );
}
