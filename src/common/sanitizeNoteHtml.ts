import DOMPurify from 'dompurify';

// Allowlist = exactly what our Tiptap config emits. No style/class/on* attrs.
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'label',
  'input',
  'span',
  'div',
  'a',
  'h1',
  'h2',
  'h3',
  'hr',
];
const ALLOWED_ATTR = ['href', 'type', 'checked', 'data-type', 'data-checked'];

export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
}
