import { sanitizeNoteHtml } from '@/common/sanitizeNoteHtml';
import { describe, expect, it } from 'vitest';

describe('sanitizeNoteHtml', () => {
  it('keeps a paragraph with bold/italic/strike marks intact', () => {
    const html = '<p><strong>bold</strong> <em>italic</em> <s>strike</s></p>';
    expect(sanitizeNoteHtml(html)).toBe(html);
  });

  it('keeps a bullet list intact', () => {
    const html = '<ul><li>one</li><li>two</li></ul>';
    expect(sanitizeNoteHtml(html)).toBe(html);
  });

  it('keeps Tiptap task list markup intact', () => {
    const html =
      '<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked><span></span></label><div><p>x</p></div></li></ul>';
    const out = sanitizeNoteHtml(html);
    expect(out).toContain('data-type="taskList"');
    expect(out).toContain('data-checked="true"');
    expect(out).toContain('data-type="taskItem"');
    expect(out).toContain('<input type="checkbox" checked');
    expect(out).toContain('<p>x</p>');
  });

  it('keeps a link with an https href', () => {
    const html = '<p><a href="https://example.com">link</a></p>';
    expect(sanitizeNoteHtml(html)).toBe(html);
  });

  it('strips script tags', () => {
    expect(sanitizeNoteHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>');
  });

  it('strips img tags with onerror payloads', () => {
    expect(sanitizeNoteHtml('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('strips svg tags with onload payloads', () => {
    expect(sanitizeNoteHtml('<svg onload=alert(1)></svg>')).toBe('');
  });

  it('strips iframe tags', () => {
    expect(sanitizeNoteHtml('<iframe src="https://evil.com"></iframe>')).toBe('');
  });

  it('removes javascript: hrefs but keeps the link text', () => {
    const out = sanitizeNoteHtml('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('href');
    expect(out).toContain('click');
  });

  it('strips onclick attributes from otherwise-allowed tags', () => {
    expect(sanitizeNoteHtml('<p onclick="alert(1)">hi</p>')).toBe('<p>hi</p>');
  });

  it('strips style attributes (no CSS overlay/redress tricks)', () => {
    expect(sanitizeNoteHtml('<div style="position:fixed;inset:0">x</div>')).toBe('<div>x</div>');
  });

  it('strips form and button tags, keeping inner text', () => {
    expect(sanitizeNoteHtml('<form><button>go</button></form>')).toBe('go');
  });

  it('strips unknown data-* attributes', () => {
    expect(sanitizeNoteHtml('<p data-foo="bar">hi</p>')).toBe('<p>hi</p>');
  });
});

describe('sanitizeNoteHtml images', () => {
  const resolve = (id: string) => (id === 'img_1' ? 'blob:http://localhost/abc' : undefined);

  it('keeps a stored image and fills src from the resolver', () => {
    const out = sanitizeNoteHtml('<img data-image-id="img_1" width="800" height="600" alt="">', resolve);
    expect(out).toBe('<img data-image-id="img_1" width="800" height="600" alt="" src="blob:http://localhost/abc">');
  });

  it('keeps a stored image without src until its blob is loaded', () => {
    expect(sanitizeNoteHtml('<img data-image-id="img_2">', resolve)).toBe('<img data-image-id="img_2">');
  });

  it('never keeps a src from the stored html', () => {
    expect(sanitizeNoteHtml('<img data-image-id="img_2" src="https://evil.com/pixel.gif">', resolve)).toBe(
      '<img data-image-id="img_2">',
    );
  });

  it('strips images that are not ours', () => {
    expect(sanitizeNoteHtml('<p>a</p><img src="https://evil.com/pixel.gif"><img src="data:image/png;base64,AA">')).toBe(
      '<p>a</p>',
    );
  });

  it('strips images with a malformed id', () => {
    expect(sanitizeNoteHtml('<img data-image-id="x&quot; onerror=&quot;alert(1)">', resolve)).toBe('');
  });

  it('ignores resolver output that is not a blob url', () => {
    expect(sanitizeNoteHtml('<img data-image-id="img_3">', () => 'javascript:alert(1)')).toBe(
      '<img data-image-id="img_3">',
    );
  });
});
