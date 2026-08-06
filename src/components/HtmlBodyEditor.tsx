import { useEffect, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Pilcrow,
} from 'lucide-react';

/** Tags/marks the Condorito app document screen can render. */
const ALLOWED_TAGS = new Set([
  'H1', 'H2', 'H3', 'P', 'UL', 'OL', 'LI',
  'STRONG', 'B', 'EM', 'I', 'U',
  'BR',
]);

function sanitizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName;
    const inner = Array.from(el.childNodes).map(walk).join('');
    if (!ALLOWED_TAGS.has(tag)) return inner;
    if (tag === 'BR') return '<br>';
    const lower = tag.toLowerCase();
    // Normalize bold/italic aliases TipTap prefers
    const outTag =
      tag === 'B' ? 'strong' :
      tag === 'I' ? 'em' :
      lower;
    return `<${outTag}>${inner}</${outTag}>`;
  };
  return Array.from(doc.body.childNodes).map(walk).join('');
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

export function HtmlBodyEditor({ value, onChange, disabled }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
      }),
      Underline,
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'html-body-editor-prose',
      },
      transformPastedHTML: sanitizePastedHtml,
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Sync external value when opening a different record (avoid clobbering while typing).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '';
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // Only re-sync when `value` identity changes from parent (e.g. modal open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  if (!editor) return null;

  const btn = (active: boolean, onClick: () => void, label: string, children: ReactNode) => (
    <button
      type="button"
      className={`html-body-toolbar-btn${active ? ' active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );

  return (
    <div className={`html-body-editor${disabled ? ' disabled' : ''}`}>
      <div className="html-body-toolbar">
        {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Heading 1', <Heading1 size={15} />)}
        {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading 2', <Heading2 size={15} />)}
        {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Heading 3', <Heading3 size={15} />)}
        {btn(editor.isActive('paragraph'), () => editor.chain().focus().setParagraph().run(), 'Paragraph', <Pilcrow size={15} />)}
        <span className="html-body-toolbar-sep" />
        {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', <Bold size={15} />)}
        {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', <Italic size={15} />)}
        {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline', <UnderlineIcon size={15} />)}
        <span className="html-body-toolbar-sep" />
        {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', <List size={15} />)}
        {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Ordered list', <ListOrdered size={15} />)}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
