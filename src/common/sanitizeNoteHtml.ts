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
  'img',
];
// No `src`: stored images are `<img data-image-id>` and only ever get a src from resolveImageSrc below,
// so note HTML can never load a remote URL (tracking pixel) or a data: payload.
const ALLOWED_ATTR = [
  'href',
  'type',
  'checked',
  'data-type',
  'data-checked',
  'data-image-id',
  'width',
  'height',
  'alt',
];
const IMAGE_ID = /^[\w-]{1,64}$/;

export function sanitizeNoteHtml(html: string, resolveImageSrc?: (imageId: string) => string | undefined): string {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const img of fragment.querySelectorAll('img')) {
    const id = img.getAttribute('data-image-id');
    if (!id || !IMAGE_ID.test(id)) {
      img.remove();
      continue;
    }
    // Only our own object URLs (created from the image store), never anything derived from the HTML
    const src = resolveImageSrc?.(id);
    if (src?.startsWith('blob:')) img.setAttribute('src', src);
  }
  // Serialize by reading innerHTML (never assigning it)
  const box = document.createElement('div');
  box.append(fragment);
  return box.innerHTML;
}
