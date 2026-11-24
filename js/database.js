const DATABASE_NAME = 'daily-bloom-local-db';
const DATABASE_VERSION = 1;
const STORE_NAME = 'app-state';
const STATE_KEY = 'main';

function createId() {
  return globalThis.crypto?.randomUUID?.() || `db-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let databasePromise;
let memoryState = null;

function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('هذا المتصفح لا يدعم التخزين المحلي المطلوب.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('تعذّر فتح التخزين المحلي.'));
      request.onblocked = () => reject(new Error('التخزين المحلي مشغول في تبويب آخر.'));
    });
  }

  return databasePromise;
}

function createEmptyState() {
  return {
    schemaVersion: 2,
    tasks: [],
    workouts: [],
    habits: [],
    taskOrders: {},
    updatedAt: new Date().toISOString()
  };
}

function migrateLegacyTasks() {
  try {
    const raw = localStorage.getItem('daily-bloom-v1');
    if (!raw) return [];

    const oldTasks = JSON.parse(raw);
    if (!Array.isArray(oldTasks)) return [];

    return oldTasks.map((oldTask) => {
      const from = oldTask.createdAt || '0000-01-01';
      const fields = {
        name: String(oldTask.name || oldTask.title || 'مهمة بدون اسم'),
        type: ['daily', 'weekly', 'once'].includes(oldTask.type) ? oldTask.type : 'daily',
        days: Array.isArray(oldTask.days) ? oldTask.days : [],
        date: oldTask.date || '',
        category: oldTask.category || 'other',
        priority: oldTask.priority || 'medium'
      };

      return {
        id: oldTask.id || createId(),
        createdAt: from,
        revisions: [{ from, fields }],
        completed: oldTask.completed && typeof oldTask.completed === 'object' ? oldTask.completed : {},
        skipped: {},
        occurrenceEdits: {},
        endsAt: null
      };
    });
  } catch {
    return [];
  }
}

function normalizeState(state) {
  const empty = createEmptyState();
  return {
    ...empty,
    ...(state || {}),
    tasks: Array.isArray(state?.tasks) ? state.tasks : [],
    workouts: Array.isArray(state?.workouts) ? state.workouts : [],
    habits: Array.isArray(state?.habits) ? state.habits : [],
    taskOrders: state?.taskOrders && typeof state.taskOrders === 'object' ? state.taskOrders : {}
  };
}

export async function loadAppState() {
  try {
    const database = await openDatabase();
    const state = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('تعذّرت قراءة بياناتك.'));
    });

    if (state) {
      memoryState = normalizeState(state);
      return { state: memoryState, storageAvailable: true, migrated: false };
    }

    const initialState = createEmptyState();
    const legacyTasks = migrateLegacyTasks();
    initialState.tasks = legacyTasks;
    await writeState(initialState);
    memoryState = initialState;
    return { state: memoryState, storageAvailable: true, migrated: legacyTasks.length > 0 };
  } catch (error) {
    memoryState = createEmptyState();
    return { state: memoryState, storageAvailable: false, error };
  }
}

async function writeState(state) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('تعذّر حفظ التغييرات.'));
    transaction.onabort = () => reject(transaction.error || new Error('تم إلغاء عملية الحفظ.'));
  });
}

export async function saveAppState(state) {
  state.updatedAt = new Date().toISOString();
  memoryState = state;
  await writeState(state);
}
