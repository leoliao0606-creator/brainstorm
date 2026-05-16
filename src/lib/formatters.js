import { getLocale } from './locale.js';

export function formatNoteTime(language, timestamp) {
  if (!timestamp) return getLocale(language).text.timeMissing;
  return new Intl.DateTimeFormat(getLocale(language).dateLocale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function formatClock(language, timestamp) {
  if (!timestamp) return getLocale(language).text.justCreated;
  return new Intl.DateTimeFormat(getLocale(language).dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
