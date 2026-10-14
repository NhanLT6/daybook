const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/**
 * Spell out the calendar around today for the system prompt. Models can't reliably work out the
 * weekday of a bare date, so "monday this week" drifted to next week's Monday; listing the dates of
 * this week and last week (Monday-first) lets the model look them up instead of computing them.
 * Dates are handled as UTC midnight, so the server's timezone can't shift them.
 */
export function dateContext(currentDate: string): string {
  const today = new Date(`${currentDate}T00:00:00Z`);
  if (Number.isNaN(today.getTime())) return `Today's date is ${currentDate}.`;

  const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
  const week = (start: Date) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return `${DAY_NAMES[d.getUTCDay()]} ${iso(d)}`;
    }).join(', ');

  return `Today is ${DAY_NAMES[today.getUTCDay()]} ${currentDate}. Weeks start on Monday.
- This week: ${week(monday)}.
- Last week: ${week(addDays(monday, -7))}.
- A weekday named with "this week" or "on <weekday>" for work already done means the date in this week (or the most recent one), never next week. Only use a future date when the user says "next" or describes planned work.`;
}
