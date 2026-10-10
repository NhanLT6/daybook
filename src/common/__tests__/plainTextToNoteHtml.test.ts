import { describe, expect, it } from 'vitest';

import { plainTextToNoteHtml } from '@/common/plainTextToNoteHtml';
import { noteToPlainText } from '@/common/searchNotes';

describe('plainTextToNoteHtml', () => {
  it('turns [ ] and [x] lines into one checklist', () => {
    const html = plainTextToNoteHtml('Standup\n[ ] ask BA\n[x] fix test');
    expect(html.match(/data-type="taskList"/g)).toHaveLength(1);
    expect(noteToPlainText(html)).toBe('Standup\n[ ] ask BA\n[x] fix test');
  });

  it('keeps bullets and paragraphs apart', () => {
    const html = plainTextToNoteHtml('Ideas\n- fewer meetings\n- pair more\n\nlater');
    expect(html).toBe('<p>Ideas</p><ul><li><p>fewer meetings</p></li><li><p>pair more</p></li></ul><p>later</p>');
  });

  it('escapes text instead of parsing it as HTML', () => {
    expect(plainTextToNoteHtml('<img src=x onerror=alert(1)>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });
});
