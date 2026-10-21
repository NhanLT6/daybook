/**
 * What Daybook is and how to use it, written for users. One source for the first-visit welcome,
 * its canned answers, and the AI's knowledge of the app (api/chat.ts and the public api/help.ts).
 * Update it when a feature changes, or the chat will explain the old behaviour.
 */

/** Questions a visitor can ask without signing in, per day (enforced by api/help.ts). */
export const HELP_DAILY_LIMIT = 5;

export const APP_GUIDE = `Daybook is a free web app for logging what you worked on each day and how long it took, so timesheets, standups and reviews are easy to fill in.

Pages (left rail on desktop, menu at the top left on phones):
- Home: a form to log time (date, project, task, duration, description), a month chart of hours per day, and the list of logs grouped by week. The Insights toggle in the chart header shows totals per project and task.
- Notes: sticky notes with checklists, colours, pins, pasted images, search, drag to reorder or to the bin.
- Tasks: the projects and tasks you log against, optionally grouped into categories.
- Events: a calendar for meetings, leave, deadlines and holidays, with repeating events and sprints (New Event ▾ → New sprints).
- Settings: daily target, weekend days, date format, categories, background, AI, backup and restore, Jira.

Logging time:
- Use the form on Home. Pick several dates to log the same entry on each. Recent Project + Task pairs are one click. The Remaining chip fills in what is left of the day's target.
- Or type it in the chat in plain words, e.g. "yesterday 2h DS-123 login bug, 30m team meeting". The chat shows cards to check, then Save. A screenshot of a calendar or timesheet works too.
- Edit or delete a log from its row in the list (hover a row for its actions).
- Plans: an entry with no duration is a plan for later.

Chat (the bar at the bottom of every page; open it with Ctrl+K, the / key, or a click):
- Commands: /log logs time, /note saves a sticky note, /event adds a calendar event, /ask answers from your notes, /catchup summarises recent work for a standup, /help shows the welcome again, /new starts a new chat, /history lists past chats.
- Keyboard: Ctrl+K (⌘K on Mac) or / opens the chat, Shift twice quickly starts a new chat, Esc goes back or closes. With the message box empty, ← or ↑ opens past chats (↑↓ to move, Enter to open, → to go back).
- Typing / mid-sentence suggests your projects, tasks and Jira tickets.
- Past chats are under the History button.

Daily target (Settings → Date & Calendar): how many hours a workday should add up to, default 8, or no limit. Weekend days and public holidays are off days: they show no Remaining, and logs on them get a soft amber outline instead of red. A day over target turns red.

Your data:
- Logs, notes, tasks and events are stored only in this browser (IndexedDB). Nothing is uploaded, so clearing site data or switching browser or device starts empty.
- Settings → Backup & Restore exports everything to a JSON file and imports it back; use it to move to another device. The log list also exports and imports CSV.
- Signing in (free, email or Google) is needed for the AI chat, Catch-up and Jira. Your AI and Jira settings are then saved to your account. Logs and notes still stay in the browser; there is no sync between devices yet.
- AI: the chat sends the message you type, plus your project and task names. Notes are read only when a question needs them. The shared AI only uses providers that don't train on your data.

AI options (Settings → AI): the shared AI is free and on by default, with a monthly quota for everyone. You can add your own Gemini API key instead.

Jira (Settings → Jira): enter your Atlassian site, email, an API token (from id.atlassian.com → Security → API tokens), the project key and the statuses to pull. Tickets then appear as tasks and in / suggestions, refreshed once a day.

Other: works on phones in the browser (no app to install). Light and dark theme via the toggle in the rail. The interface is in English; the chat understands any language.`;

export const WELCOME_TEXT = `Hi, welcome to Daybook! 👋

Daybook keeps a simple diary of your work: what you did each day and how long it took. Log it with the form on Home, or just tell me here, like "2h on the login bug yesterday". Notes, events and charts sit alongside.

Everything stays in your browser. Ask me anything about the app.`;

export interface HelpSuggestion {
  question: string;
  answer: string;
}

// Shown as chips under the welcome; answered from here, instantly and without using the AI quota
export const HELP_SUGGESTIONS: HelpSuggestion[] = [
  {
    question: 'How do I log my first day?',
    answer: `Two ways:
• The form on Home: pick the date, project and task, enter how long, Save. New projects and tasks are created as you type them.
• Here in the chat (after signing in): write it as you'd say it, e.g. "today 3h DS-123 checkout bug, 1h code review". I show cards to check, then you press Save.

The chart and list on Home fill in as you go.`,
  },
  {
    question: 'Where is my data stored?',
    answer: `Only in this browser. Logs, notes, tasks and events never leave your device, so there's nothing to set up.

That also means clearing site data, or opening Daybook in another browser, starts empty. Settings → Backup & Restore exports everything to a file you can import anywhere.`,
  },
  {
    question: 'Do I need an account?',
    answer: `No. Logging, notes, events and charts all work without one.

Signing in (free, email or Google) adds the AI chat, Catch-up summaries for standups and Jira tickets. Your logs still stay in the browser.`,
  },
  {
    question: 'What can the chat do?',
    answer: `Type / to see the commands:
• /log: log time in plain words or from a screenshot
• /note: save a sticky note
• /event: add a meeting or leave to the calendar
• /ask: find something in your notes
• /catchup: summarise recent work for a standup
• /help: show this welcome again

Open the chat anytime with Ctrl+K or the / key.`,
  },
];

export const HELP_SIGN_IN_HINT = `You can ask ${HELP_DAILY_LIMIT} questions a day before signing in.`;
