'use client';

import { PaperPlaneTiltIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { sendContactRequestAction } from '@/app/[locale]/(auth)/dashboard/cases/[id]/actions';
import { RichTextEditor } from '@/components/claims/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { contactDeclarations, contactPurposes } from '@/utils/contact/ContactRequest';

const knownIssues = [
  'forbidden_words',
  'promise_words',
  'advert_words',
  'rules_missing',
  'purpose_other_missing',
] as const;

/**
 * The request form behind the "Contact the claimants" button for a verified organisation. It asks who is asking and why, the six
 * rules to agree to and the message claimants will read, and sends it for review. Nobody is contacted until staff approve it and
 * each claimant says yes; the server checks every field again.
 * @param props - The dialog props.
 * @param props.caseId - The case the request is about.
 * @returns The button and its form.
 */
export function ContactClaimantsDialog(props: { caseId: string }) {
  const t = useTranslations('CaseDetail');
  const [open, setOpen] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const [purposeChoice, setPurposeChoice] = React.useState('');
  const [terms, setTerms] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          setError(null);
          setSent(false);
          setAgreed(false);
          setTerms(false);
          setPurposeChoice('');
        }}
      >
        <DialogTrigger asChild>
          <Button size="lg">
            <PaperPlaneTiltIcon aria-hidden="true" />
            {t('contact_action_full')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] gap-4 max-md:overflow-y-auto sm:max-w-2xl">
          {sent ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('contact_sent_title')}</DialogTitle>
                <DialogDescription>{t('contact_sent_text')}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setOpen(false);
                  }}
                >
                  {t('locked_close')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);

                startTransition(async () => {
                  const result = await sendContactRequestAction(props.caseId, data);
                  const known = knownIssues.find((issue) => result.issues.includes(issue));

                  setError(
                    result.problem === null
                      ? null
                      : t(
                          `contact_error_${result.problem === 'invalid' ? (known ?? 'invalid') : result.problem}`,
                        ),
                  );
                  setSent(result.problem === null);
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>{t('contact_form_title')}</DialogTitle>
                <DialogDescription>{t('contact_form_text')}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid content-start gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="contact-purpose">{t('contact_purpose_label')}</Label>
                      <Select
                        name="purpose"
                        required
                        value={purposeChoice}
                        onValueChange={setPurposeChoice}
                      >
                        <SelectTrigger id="contact-purpose" className="w-full">
                          <SelectValue placeholder={t('contact_purpose_placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {contactPurposes.map((purpose) => (
                            <SelectItem key={purpose} value={purpose}>
                              {t(`contact_purpose_${purpose}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contact-role">{t('contact_role_label')}</Label>
                      <Input
                        id="contact-role"
                        name="askerRole"
                        required
                        minLength={2}
                        maxLength={80}
                      />
                    </div>
                  </div>
                  {purposeChoice === 'other' && (
                    <div className="grid gap-2">
                      <Label htmlFor="contact-purpose-other">
                        {t('contact_purpose_other_label')}
                      </Label>
                      <Input
                        id="contact-purpose-other"
                        name="purposeOther"
                        required
                        minLength={3}
                        maxLength={120}
                      />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="contact-reason">{t('contact_reason_label')}</Label>
                    <Input
                      id="contact-reason"
                      name="reason"
                      required
                      minLength={40}
                      maxLength={1000}
                    />
                    <p className="text-xs text-ink-muted">{t('contact_reason_hint')}</p>
                  </div>
                </div>
                <div className="grid content-start gap-2">
                  <Label id="contact-message-label">{t('contact_message_label')}</Label>
                  <RichTextEditor
                    labelId="contact-message-label"
                    name="message"
                    defaultValue=""
                    compact
                  />
                  <p className="text-xs text-ink-muted">{t('contact_message_hint')}</p>
                </div>
              </div>
              {agreed &&
                contactDeclarations.map((rule) => (
                  <input key={rule} type="hidden" name="declarations" value={rule} />
                ))}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="contact-agree"
                  checked={agreed}
                  onCheckedChange={(next) => {
                    // Agreeing happens in the terms, so ticking opens them; unticking withdraws the agreement.
                    if (next === true) {
                      setTerms(true);
                    } else {
                      setAgreed(false);
                    }
                  }}
                />
                <Label htmlFor="contact-agree" className="font-normal">
                  {t.rich('contact_rules_agree', {
                    terms: (chunks) => (
                      <button
                        type="button"
                        className="font-medium underline underline-offset-4 focus-ring"
                        onClick={() => {
                          setTerms(true);
                        }}
                      >
                        {chunks}
                      </button>
                    ),
                  })}
                </Label>
              </div>
              {error && (
                <p role="alert" className="text-sm text-seal">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {t('contact_send')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={terms} onOpenChange={setTerms}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('contact_terms_title')}</DialogTitle>
            <DialogDescription>{t('contact_rules_label')}</DialogDescription>
          </DialogHeader>
          <ul className="grid list-disc gap-3 pl-5 text-sm">
            {contactDeclarations.map((rule) => (
              <li key={rule}>{t(`contact_rule_${rule}`)}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTerms(false);
              }}
            >
              {t('contact_terms_cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAgreed(true);
                setTerms(false);
              }}
            >
              {t('contact_terms_accept')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
