export const WEEKDAYS = [
  { value: 0, short: 'أحد', full: 'الأحد' },
  { value: 1, short: 'اثنين', full: 'الاثنين' },
  { value: 2, short: 'ثلاثاء', full: 'الثلاثاء' },
  { value: 3, short: 'أربعاء', full: 'الأربعاء' },
  { value: 4, short: 'خميس', full: 'الخميس' },
  { value: 5, short: 'جمعة', full: 'الجمعة' },
  { value: 6, short: 'سبت', full: 'السبت' }
];

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function fromDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat('ar', {
    weekday: options.weekday || undefined,
    day: 'numeric',
    month: options.month || 'long',
    year: options.year === false ? undefined : 'numeric'
  }).format(date);
}

export function formatMonth(date) {
  return new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(date);
}

export function isSameDate(first, second) {
  return toDateKey(first) === toDateKey(second);
}

export function monthGridStart(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return addDays(first, -first.getDay());
}

export function monthGridEnd(date) {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return addDays(last, 6 - last.getDay());
}

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `db-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
