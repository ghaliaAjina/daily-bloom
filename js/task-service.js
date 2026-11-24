import { toDateKey, addDays, createId } from './date-utils.js';

const INITIAL_DATE = '0000-01-01';

function normalizeFields(fields) {
  return {
    name: String(fields.name || '').trim(),
    type: fields.type || 'daily',
    days: Array.isArray(fields.days) ? [...new Set(fields.days)].sort() : [],
    date: fields.date || '',
    category: fields.category || 'other',
    priority: fields.priority || 'medium'
  };
}

export function createTask(input, date) {
  const createdAt = toDateKey(date);
  return {
    id: createId(),
    createdAt,
    revisions: [{ from: createdAt, fields: normalizeFields(input) }],
    completed: {},
    skipped: {},
    occurrenceEdits: {},
    endsAt: null
  };
}

export function getTaskFieldsForDate(task, date) {
  const dateKey = typeof date === 'string' ? date : toDateKey(date);
  const revision = [...(task.revisions || [])]
    .filter((item) => item.from <= dateKey)
    .sort((a, b) => a.from.localeCompare(b.from))
    .at(-1);
  const fields = revision?.fields || task.revisions?.[0]?.fields || {};
  return normalizeFields({ ...fields, ...(task.occurrenceEdits?.[dateKey] || {}) });
}

export function isTaskDue(task, date) {
  const dateKey = typeof date === 'string' ? date : toDateKey(date);
  if (dateKey < task.createdAt) return false;
  if (task.endsAt && dateKey > task.endsAt) return false;
  if (task.skipped?.[dateKey]) return false;

  const fields = getTaskFieldsForDate(task, dateKey);
  if (fields.type === 'daily') return true;
  if (fields.type === 'weekly') return fields.days.includes(new Date(`${dateKey}T12:00:00`).getDay());
  return fields.date === dateKey;
}

export function isTaskCompleted(task, date) {
  return Boolean(task.completed?.[typeof date === 'string' ? date : toDateKey(date)]);
}

export function getTasksForDate(state, date) {
  const dateKey = toDateKey(date);
  const dueTasks = state.tasks.filter((task) => isTaskDue(task, dateKey));
  const order = state.taskOrders?.[dateKey] || [];
  const orderIndex = new Map(order.map((id, index) => [id, index]));

  return dueTasks
    .map((task) => ({ ...task, displayFields: getTaskFieldsForDate(task, dateKey), done: isTaskCompleted(task, dateKey) }))
    .sort((first, second) => {
      const firstIndex = orderIndex.has(first.id) ? orderIndex.get(first.id) : Number.MAX_SAFE_INTEGER;
      const secondIndex = orderIndex.has(second.id) ? orderIndex.get(second.id) : Number.MAX_SAFE_INTEGER;
      if (firstIndex !== secondIndex) return firstIndex - secondIndex;
      const priorityRank = { high: 0, medium: 1, low: 2 };
      return (priorityRank[first.displayFields.priority] ?? 1) - (priorityRank[second.displayFields.priority] ?? 1);
    });
}

export function toggleTaskDone(task, date) {
  const dateKey = toDateKey(date);
  task.completed ||= {};
  if (task.completed[dateKey]) delete task.completed[dateKey];
  else task.completed[dateKey] = true;
}

export function skipTaskForDate(task, date) {
  task.skipped ||= {};
  task.skipped[toDateKey(date)] = true;
}

export function editTaskOccurrence(task, date, fields) {
  const dateKey = toDateKey(date);
  const current = getTaskFieldsForDate(task, dateKey);

  if (current.type === 'once') {
    const initialRevision = [...task.revisions].reverse().find((item) => item.from <= dateKey) || task.revisions[0];
    initialRevision.fields = normalizeFields(fields);
    return;
  }

  task.occurrenceEdits ||= {};
  task.occurrenceEdits[dateKey] = normalizeFields({ ...current, ...fields });
}

export function editTaskFromDate(task, date, fields) {
  const dateKey = toDateKey(date);
  task.revisions ||= [];
  // A future-wide edit replaces the schedule versions from this date onward.
  task.revisions = task.revisions.filter((revision) => revision.from < dateKey);
  task.revisions.push({ from: dateKey, fields: normalizeFields(fields) });
  task.revisions.sort((first, second) => first.from.localeCompare(second.from));

  if (task.occurrenceEdits) {
    for (const overrideDate of Object.keys(task.occurrenceEdits)) {
      if (overrideDate >= dateKey) delete task.occurrenceEdits[overrideDate];
    }
  }
}

export function endTaskFromDate(task, date) {
  task.endsAt = toDateKey(addDays(date, -1));
}

export function reorderTasksForDate(state, date, orderedIds) {
  state.taskOrders ||= {};
  state.taskOrders[toDateKey(date)] = [...orderedIds];
}
