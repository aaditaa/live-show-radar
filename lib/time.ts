/** Times are stored in UTC everywhere and rendered in Asia/Kolkata. */

export const IST = 'Asia/Kolkata';

const dateTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const dateOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const monthOnly = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  month: 'long',
  year: 'numeric',
});

export function formatIstDateTime(value: Date | string | null | undefined): string {
  if (!value) return 'TBA';
  return `${dateTime.format(new Date(value))} IST`;
}

/** `event_date` is a plain date column; parse it as IST midday to avoid TZ drift. */
export function formatEventDate(
  eventDate: string | null | undefined,
  precision: 'day' | 'month' = 'day',
): string {
  if (!eventDate) return 'TBA';
  const parsed = new Date(`${eventDate}T12:00:00+05:30`);
  if (Number.isNaN(parsed.getTime())) return 'TBA';
  return precision === 'month' ? monthOnly.format(parsed) : dateOnly.format(parsed);
}

export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return 'never';
  const then = new Date(value).getTime();
  const diffMinutes = Math.round((Date.now() - then) / 60_000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function formatCountdown(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return 'ended';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min`;
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}
