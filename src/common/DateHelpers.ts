import dayjs from 'dayjs';

export const minutesToHourWithMinutes = (minutes: number): string => {
  if (minutes === 0) return '0m';

  const time = dayjs.duration({ minutes: Math.round(minutes) });
  const hours = Math.floor(time.asHours());
  const remainingMinutes = dayjs
    .duration({ hours: time.asHours() - hours })
    .asMinutes()
    .toFixed(0);

  if (hours === 0) return `${remainingMinutes}m`;

  if (remainingMinutes === '0') return `${hours}h`;

  return `${hours}h ${remainingMinutes}m`;
};
