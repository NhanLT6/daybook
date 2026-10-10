import { escape } from 'lodash';

const TASK_LINE = /^(?:[-*]\s*)?\[( |x|X)\]\s*(.*)$/;
const BULLET_LINE = /^[-*•]\s+(.*)$/;

// Same shape Tiptap's TaskItem renders, so the card preview and its tick-from-card work on it
const taskItem = (checked: boolean, text: string) =>
  `<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${escape(text)}</p></div></li>`;

/**
 * Plain text from Chat (addNote) → note HTML. `[ ] x` / `[x] x` lines become a checklist,
 * `- x` lines a bullet list, anything else a paragraph. Text is escaped, never parsed as HTML.
 */
interface ListGroup {
  kind: 'task' | 'bullet';
  items: string[];
}

export function plainTextToNoteHtml(text: string): string {
  const blocks: string[] = [];
  // Cast keeps TS from narrowing to null: flush() reassigns it from a closure
  let list = null as ListGroup | null;

  const flush = () => {
    if (!list) return;
    blocks.push(
      list.kind === 'task'
        ? `<ul data-type="taskList">${list.items.join('')}</ul>`
        : `<ul>${list.items.join('')}</ul>`,
    );
    list = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }

    const task = TASK_LINE.exec(line);
    const bullet = !task && BULLET_LINE.exec(line);
    const kind = task ? 'task' : bullet ? 'bullet' : null;

    if (kind && list?.kind !== kind) flush();
    if (task) {
      list ??= { kind: 'task', items: [] };
      list.items.push(taskItem(task[1] !== ' ', task[2]));
    } else if (bullet) {
      list ??= { kind: 'bullet', items: [] };
      list.items.push(`<li><p>${escape(bullet[1])}</p></li>`);
    } else {
      flush();
      blocks.push(`<p>${escape(line)}</p>`);
    }
  }
  flush();

  return blocks.join('');
}
