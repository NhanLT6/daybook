import { NOTE_COLORS, type Note } from '@/interfaces/Note';

import { nanoid } from 'nanoid';

// Dev-only: random notes for trying delete/drag without typing each one (Notes toolbar, `yarn dev` only).

const TITLES = [
  'Ask Bob about T-123 deploy',
  'Standup: login bug workaround still needed?',
  'Review PR for strong typing',
  'Check Sentry spike after release',
  'Follow up with QA on flaky test',
  'Update Xero template path',
  'Jira: split story into subtasks',
  'Pair with Anna on caching',
  'Retro idea: fewer meetings on Friday',
  'Clean up feature flags',
];

const TASKS = ['Check logs', 'Confirm rollout', 'Ping PM', 'Write test', 'Update docs', 'Close ticket'];

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

const sampleContent = () => {
  const title = `<p>${pick(TITLES)}</p>`;
  const roll = Math.random();
  if (roll < 0.4) {
    const items = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => {
      const checked = Math.random() < 0.4;
      return `<li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label><div><p>${pick(TASKS)}</p></div></li>`;
    }).join('');
    return `${title}<ul data-type="taskList">${items}</ul>`;
  }
  if (roll < 0.6) return `${title}<ul><li><p>${pick(TASKS)}</p></li><li><p>${pick(TASKS)}</p></li></ul>`;
  return `${title}<p><strong>Note:</strong> ${pick(TASKS).toLowerCase()} before EOD.</p>`;
};

// `topOrder` = an order at or above every existing note's, so the samples show up first.
export const createSampleNotes = (count: number, topOrder: number): Note[] => {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: nanoid(),
    content: sampleContent(),
    order: topOrder - count + i,
    createdAt: now,
    updatedAt: now - i * 60_000,
    pinned: Math.random() < 0.15,
    color: Math.random() < 0.5 ? pick(NOTE_COLORS) : undefined,
  }));
};
