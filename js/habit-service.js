import { toDateKey, createId } from './date-utils.js';

export function isHabitDue(habit, date) {
  const dateKey = toDateKey(date);
  if (dateKey < habit.createdAt) return false;
  if (habit.archivedAt && dateKey >= habit.archivedAt) return false;
  if (habit.type === 'weekly') return habit.days.includes(date.getDay());
  return true;
}

export function isHabitDone(habit, date) {
  return Boolean(habit.completed?.[toDateKey(date)]);
}

export function createHabit(input, date) {
  return {
    id: createId(),
    name: String(input.name || '').trim(),
    type: input.type || 'daily',
    days: Array.isArray(input.days) ? [...new Set(input.days)].sort() : [],
    category: input.category || 'personal',
    createdAt: toDateKey(date),
    completed: {},
    archivedAt: null
  };
}

export function toggleHabitDone(habit, date) {
  const dateKey = toDateKey(date);
  habit.completed ||= {};
  if (habit.completed[dateKey]) delete habit.completed[dateKey];
  else habit.completed[dateKey] = true;
}

export function getHabitStreak(habit, referenceDate) {
  let cursor = new Date(referenceDate);
  const today = new Date();
  if (toDateKey(cursor) === toDateKey(today) && isHabitDue(habit, cursor) && !isHabitDone(habit, cursor)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  let checkedDays = 0;

  while (checkedDays < 370 && toDateKey(cursor) >= habit.createdAt) {
    if (isHabitDue(habit, cursor)) {
      checkedDays += 1;
      if (isHabitDone(habit, cursor)) streak += 1;
      else break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
