'use client';

import {
  LinkIcon,
  LinkBreakIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  QuotesIcon,
  TextBIcon,
  TextHIcon,
  TextItalicIcon,
} from '@phosphor-icons/react';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/Cn';

// What the writing area looks like, so a heading, a list, a quote and a link read the way they will for a lawyer.
const surface =
  'p-4 text-base outline-none [&>*+*]:mt-3 [&_h2]:text-lg [&_h2]:font-medium [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-ink-muted [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4';

function ToolButton(props: {
  label: string;
  active?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={props.active ? 'default' : 'ghost'}
      size="sm"
      aria-label={props.label}
      aria-pressed={props.active ?? false}
      title={props.label}
      // Keep the selection in the writing area while a button is pressed.
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={props.onPress}
    >
      {props.children}
    </Button>
  );
}

function Toolbar(props: { editor: Editor }) {
  const t = useTranslations('ClaimPage');
  const { editor } = props;
  const [linking, setLinking] = React.useState(false);
  const [address, setAddress] = React.useState('');
  const on = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      heading: current.isActive('heading'),
      quote: current.isActive('blockquote'),
      bullets: current.isActive('bulletList'),
      numbers: current.isActive('orderedList'),
      link: current.isActive('link'),
    }),
  });
  const chain = () => editor.chain().focus();
  const applyLink = () => {
    const href = address.trim();

    if (href && URL.canParse(href) && /^(https?|mailto):/iu.test(href)) {
      chain().extendMarkRange('link').setLink({ href }).run();
    }

    setLinking(false);
    setAddress('');
  };

  return (
    <div className="grid gap-2">
      <div
        className="flex flex-wrap items-center gap-1 border-b border-border p-2"
        role="toolbar"
        aria-label={t('editor_tools')}
      >
        <ToolButton
          label={t('editor_bold')}
          active={on.bold}
          onPress={() => chain().toggleBold().run()}
        >
          <TextBIcon aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('editor_italic')}
          active={on.italic}
          onPress={() => chain().toggleItalic().run()}
        >
          <TextItalicIcon aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('editor_heading')}
          active={on.heading}
          onPress={() => chain().toggleHeading({ level: 2 }).run()}
        >
          <TextHIcon aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('editor_quote')}
          active={on.quote}
          onPress={() => chain().toggleBlockquote().run()}
        >
          <QuotesIcon aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('editor_bullets')}
          active={on.bullets}
          onPress={() => chain().toggleBulletList().run()}
        >
          <ListBulletsIcon aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('editor_numbers')}
          active={on.numbers}
          onPress={() => chain().toggleOrderedList().run()}
        >
          <ListNumbersIcon aria-hidden="true" />
        </ToolButton>
        {on.link ? (
          <ToolButton
            label={t('editor_unlink')}
            active
            onPress={() => chain().extendMarkRange('link').unsetLink().run()}
          >
            <LinkBreakIcon aria-hidden="true" />
          </ToolButton>
        ) : (
          <ToolButton
            label={t('editor_link')}
            onPress={() => {
              setLinking(!linking);
            }}
          >
            <LinkIcon aria-hidden="true" />
          </ToolButton>
        )}
      </div>
      {linking && (
        <div className="flex flex-wrap gap-2 px-2 pb-2">
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            aria-label={t('editor_link_address')}
            className="min-w-0 flex-1"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
            }}
            // Enter adds the link; it must never send the claim form.
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              }
            }}
          />
          <Button type="button" size="sm" onClick={applyLink}>
            {t('editor_link_add')}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * A rich text editor: the person sees bold, headings, lists, quotes and links as they write them, with a toolbar, and never a
 * mark-up symbol. What is sent in the form under `name` is the same text in markdown, which is how it is stored and how lawyers
 * read it, so an account written as plain text before still opens as it was.
 * @param props - The editor props.
 * @param props.labelId - The id of the label that names the writing area.
 * @param props.name - The form field that receives the text.
 * @param props.defaultValue - The text to start with, as saved.
 * @param props.invalid - Whether the text was refused.
 * @param props.compact - A writing area four lines tall for an editor inside a dialog: longer text scrolls inside it without a
 * visible scrollbar.
 * @param props.onChange - Called with the new text, as markdown, after each edit.
 * @returns The editor.
 */
export function RichTextEditor(props: {
  labelId: string;
  name: string;
  defaultValue: string;
  invalid?: boolean;
  compact?: boolean;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = React.useState(props.defaultValue);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        underline: false,
      }),
      Markdown,
    ],
    content: props.defaultValue,
    contentType: 'markdown',
    // The page is drawn on the server first; the editor appears once it is in the browser.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': props.labelId,
        class: cn(
          surface,
          props.compact
            ? 'max-h-30 min-h-30 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'min-h-96',
        ),
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = current.getMarkdown();

      setValue(markdown);
      props.onChange?.(markdown);
    },
  });

  return (
    <div
      className={cn(
        'border border-input bg-surface focus-within:ring-2 focus-within:ring-ring',
        props.compact ? null : 'min-h-96',
        props.invalid && 'border-destructive',
      )}
    >
      <input type="hidden" name={props.name} value={value} />
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
