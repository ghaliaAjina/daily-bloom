import { loadAppState, saveAppState } from './database.js';
import { WEEKDAYS, toDateKey, fromDateKey, addDays, formatDate, formatMonth, isSameDate, monthGridStart } from './date-utils.js';
import { CATEGORIES, categoryOptions, getCategory, getPriority } from './catalog.js';
import {
  createTask, getTaskFieldsForDate, getTasksForDate, isTaskDue, isTaskCompleted,
  toggleTaskDone, skipTaskForDate, editTaskOccurrence, editTaskFromDate,
  endTaskFromDate, reorderTasksForDate
} from './task-service.js';
import { createHabit, isHabitDue, isHabitDone, toggleHabitDone, getHabitStreak } from './habit-service.js';
import { createWorkout, getWorkoutStats, toggleSetCompleted } from './fitness-service.js';

const $ = (id) => document.getElementById(id);
const mainContent = $('mainContent');
const stateResult = await loadAppState();
const state = stateResult.state;
let currentPage = 'home';
let selectedDate = new Date();
let calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let taskFilter = 'all';
let selectedCategory = 'all';
let prioritySort = false;
let editingTaskId = null;
let deletingTaskId = null;
let editingHabitId = null;
let editingWorkoutId = null;
let draggedTaskId = null;
let toastTimer = null;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

async function persist(message = '') {
  try {
    await saveAppState(state);
    if (message) showToast(message);
  } catch (error) {
    showToast('تعذّر حفظ التغيير على الجهاز. تأكدي من مساحة التخزين وإعدادات Safari.');
    console.error('Daily Bloom persistence error:', error);
  }
}

function categoryBadge(categoryId) {
  const category = getCategory(categoryId);
  return `<span class="badge ${category.className}">${category.icon} ${category.label}</span>`;
}

function priorityBadge(priorityId) {
  const priority = getPriority(priorityId);
  return `<span class="badge"><i class="priority-dot ${priority.className}"></i> ${priority.label}</span>`;
}

function dateStripMarkup() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(selectedDate, index - 3);
    const active = isSameDate(date, selectedDate);
    return `<button class="date-pill ${active ? 'active' : ''}" type="button" data-date="${toDateKey(date)}">
      <small>${WEEKDAYS[date.getDay()].short}</small><strong>${date.getDate()}</strong><em>${date.toLocaleDateString('ar', { month: 'short' })}</em>
    </button>`;
  }).join('');
}

function renderHome() {
  const tasks = getTasksForDate(state, selectedDate);
  const visibleTasks = tasks.filter((task) => {
    const categoryMatches = selectedCategory === 'all' || task.displayFields.category === selectedCategory;
    const statusMatches = taskFilter === 'all' || (taskFilter === 'done' ? task.done : !task.done);
    return categoryMatches && statusMatches;
  });

  if (prioritySort) {
    const rank = { high: 0, medium: 1, low: 2 };
    visibleTasks.sort((first, second) => rank[first.displayFields.priority] - rank[second.displayFields.priority]);
  }

  const doneCount = tasks.filter((task) => task.done).length;
  const completion = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const habitsForDay = state.habits.filter((habit) => isHabitDue(habit, selectedDate));
  const habitsDone = habitsForDay.filter((habit) => isHabitDone(habit, selectedDate)).length;
  const workoutsForDay = state.workouts.filter((workout) => workout.date === toDateKey(selectedDate));
  const selectedLabel = formatDate(selectedDate, { weekday: 'long' });

  mainContent.innerHTML = `
    <section class="page-intro"><div><span class="eyebrow">A LITTLE PROGRESS EVERY DAY</span><h1>مساحتك اليومية 🌷</h1><p>نظّمي مهامك وخططي ليومك بهدوء.</p></div><button class="button button-primary" type="button" data-action="add-task">＋ مهمة جديدة</button></section>
    <section class="hero-card"><h2>${isSameDate(selectedDate, new Date()) ? 'أهلاً في يومك الجميل ✨' : `خطة ${selectedLabel} اللطيفة 🌸`}</h2><p>خدي نفس عميق… وكل خطوة صغيرة بتفرق.</p><div class="hero-progress"><div class="progress-track"><span style="width:${completion}%"></span></div><span class="progress-caption">${doneCount} من ${tasks.length} مهام · ${completion}%</span></div></section>
    <div class="section-title"><div><h2>اختاري اليوم</h2><p>التاريخ واضح حتى ما تختلط عليك الأيام</p></div><button class="button button-quiet button-small" type="button" data-action="go-today">اليوم</button></div>
    <div class="date-strip">${dateStripMarkup()}</div>
    <div class="stat-grid">
      <div class="stat-card"><strong>${tasks.length}</strong><small>مهام اليوم</small></div>
      <div class="stat-card"><strong>${habitsDone}/${habitsForDay.length}</strong><small>عادات مكتملة</small></div>
      <div class="stat-card"><strong>${workoutsForDay.length}</strong><small>جلسات رياضية</small></div>
    </div>
    <div class="section-title"><div><h2>قائمة المهام ✿</h2><p>رتّبيها بالطريقة اللي بتناسب يومك</p></div><button class="button button-soft button-small" type="button" data-action="toggle-priority-sort">${prioritySort ? 'الترتيب اليدوي' : 'حسب الأولوية'}</button></div>
    <div class="filter-row">
      <button class="filter-chip ${taskFilter === 'all' ? 'active' : ''}" data-task-filter="all" type="button">الكل</button>
      <button class="filter-chip ${taskFilter === 'active' ? 'active' : ''}" data-task-filter="active" type="button">المتبقي</button>
      <button class="filter-chip ${taskFilter === 'done' ? 'active' : ''}" data-task-filter="done" type="button">المكتمل</button>
    </div>
    <div class="filter-row category-filters">
      <button class="filter-chip ${selectedCategory === 'all' ? 'active' : ''}" data-category-filter="all" type="button">كل التصنيفات</button>
      ${CATEGORIES.map((category) => `<button class="filter-chip ${selectedCategory === category.id ? 'active' : ''}" data-category-filter="${category.id}" type="button">${category.icon}</button>`).join('')}
    </div>
    <section class="task-list" id="taskList">
      ${visibleTasks.length ? visibleTasks.map((task, index) => taskCardMarkup(task, index, visibleTasks.length)).join('') : `<div class="empty-state"><div class="empty-emoji">${taskFilter === 'done' ? '🌼' : '☁️'}</div><strong>${taskFilter === 'done' ? 'لسه ما في مهام مكتملة' : 'ما في مهام بهالقائمة'}</strong><small>ضيفي مهمة صغيرة أو استمتعي بمساحتك الهادية 💗</small></div>`}
    </section>
    <p class="quick-note">المهام والعادات والتمارين محفوظة محلياً على هذا الجهاز فقط.</p>`;
}

function taskCardMarkup(task, index, count) {
  const fields = task.displayFields;
  const typeLabel = fields.type === 'daily' ? 'يومي' : fields.type === 'weekly' ? 'أسبوعي' : 'مرة واحدة';
  const scheduleLabel = fields.type === 'weekly' ? fields.days.map((day) => WEEKDAYS[day]?.short).filter(Boolean).join('، ') : fields.type === 'once' ? formatDate(fromDateKey(fields.date), { month: 'short', year: false }) : 'يتكرر كل يوم';
  return `<article class="task-card ${task.done ? 'is-done' : ''}" data-task-card="${task.id}" draggable="${!prioritySort && taskFilter === 'all' && selectedCategory === 'all'}">
    <button class="check-button ${task.done ? 'checked' : ''}" data-action="toggle-task" data-id="${task.id}" type="button" aria-label="${task.done ? 'إلغاء الإنجاز' : 'إنجاز المهمة'}">${task.done ? '✓' : ''}</button>
    <div class="task-main"><div class="task-name">${escapeHtml(fields.name)}</div><div class="task-subtitle"><span>${typeLabel} · ${scheduleLabel}</span></div><div class="task-badges">${categoryBadge(fields.category)}${priorityBadge(fields.priority)}</div></div>
    <div class="task-actions">
      ${!prioritySort && taskFilter === 'all' && selectedCategory === 'all' ? `<button class="mini-action" data-action="move-task" data-id="${task.id}" data-direction="up" type="button" aria-label="نقل لأعلى" ${index === 0 ? 'disabled' : ''}>↑</button><button class="mini-action" data-action="move-task" data-id="${task.id}" data-direction="down" type="button" aria-label="نقل لأسفل" ${index === count - 1 ? 'disabled' : ''}>↓</button>` : ''}
      <button class="mini-action" data-action="edit-task" data-id="${task.id}" type="button" aria-label="تعديل">✎</button>
      <button class="mini-action" data-action="delete-task" data-id="${task.id}" type="button" aria-label="إخفاء أو حذف">×</button>
    </div>
  </article>`;
}

function getCalendarDayInfo(date) {
  const dueTasks = state.tasks.filter((task) => isTaskDue(task, date));
  const dueHabits = state.habits.filter((habit) => isHabitDue(habit, date));
  const workouts = state.workouts.filter((workout) => workout.date === toDateKey(date));
  return { hasTasks: dueTasks.length > 0, hasHabits: dueHabits.length > 0, hasWorkout: workouts.length > 0, taskCount: dueTasks.length };
}

function renderPlanner() {
  const start = monthGridStart(calendarCursor);
  const dates = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const selectedTasks = getTasksForDate(state, selectedDate);
  const selectedHabits = state.habits.filter((habit) => isHabitDue(habit, selectedDate));
  const selectedWorkouts = state.workouts.filter((workout) => workout.date === toDateKey(selectedDate));

  mainContent.innerHTML = `
    <section class="page-intro"><div><span class="eyebrow">YOUR MONTH AT A GLANCE</span><h1>التقويم الشهري 📅</h1><p>اختاري أي يوم وشوفي شو مخططة إله.</p></div></section>
    <section class="calendar-card">
      <div class="calendar-header"><h2>${formatMonth(calendarCursor)}</h2><div class="calendar-nav"><button type="button" data-action="previous-month" aria-label="الشهر السابق">‹</button><button type="button" data-action="next-month" aria-label="الشهر التالي">›</button></div></div>
      <div class="calendar-grid">
        ${WEEKDAYS.map((day) => `<div class="calendar-weekday">${day.short}</div>`).join('')}
        ${dates.map((date) => {
          const info = getCalendarDayInfo(date);
          const isCurrentMonth = date.getMonth() === calendarCursor.getMonth();
          return `<button type="button" class="calendar-day ${isCurrentMonth ? '' : 'muted'} ${isSameDate(date, new Date()) ? 'today' : ''} ${isSameDate(date, selectedDate) ? 'selected' : ''}" data-calendar-date="${toDateKey(date)}"><strong>${date.getDate()}</strong><span class="calendar-dots">${info.hasTasks ? '<i></i>' : ''}${info.hasHabits ? '<i class="habit-dot"></i>' : ''}${info.hasWorkout ? '<i class="workout-dot"></i>' : ''}</span></button>`;
        }).join('')}
      </div>
      <div class="calendar-legend"><span><i class="legend-dot" style="background:#d69aaa"></i> مهام</span><span><i class="legend-dot" style="background:#91ad94"></i> عادات</span><span><i class="legend-dot" style="background:#c6ad76"></i> رياضة</span></div>
    </section>
    <section class="selected-day-panel"><h3>${formatDate(selectedDate, { weekday: 'long' })} · ${formatDate(selectedDate)}</h3><p>${selectedTasks.length} مهام · ${selectedHabits.length} عادات · ${selectedWorkouts.length} جلسات رياضية</p><div style="margin-top:11px"><button class="button button-primary button-small" type="button" data-action="open-selected-day">عرض هذا اليوم</button></div></section>`;
}

function workoutCardMarkup(workout) {
  const stats = getWorkoutStats(workout);
  return `<article class="workout-card" data-workout="${workout.id}">
    <div class="workout-card-head"><div><h3>${escapeHtml(workout.title)}</h3><p>${stats.exerciseCount} تمارين · ${stats.completedSets}/${stats.totalSets} مجموعات مكتملة</p></div><button type="button" class="mini-action danger" data-action="delete-workout" data-id="${workout.id}" aria-label="حذف الجلسة">×</button></div>
    ${workout.exercises.map((exercise) => `<div class="exercise-block"><div class="exercise-head"><strong>${escapeHtml(exercise.name)}</strong><div class="exercise-actions"><small>${exercise.sets.length} مجموعات</small><button type="button" class="mini-action" data-action="add-set" data-workout-id="${workout.id}" data-exercise-id="${exercise.id}" aria-label="إضافة مجموعة">＋</button><button type="button" class="mini-action danger" data-action="delete-exercise" data-workout-id="${workout.id}" data-exercise-id="${exercise.id}" aria-label="حذف التمرين">×</button></div></div><div class="set-table"><span class="set-header">المجموعة</span><span class="set-header">العدات</span><span class="set-header">الوزن (كغ)</span><span class="set-header">تم؟</span>
      ${exercise.sets.map((set, index) => `<span class="set-cell">${index + 1}</span><input class="set-cell" type="number" min="0" step="1" value="${set.reps}" data-set-field="reps" data-workout-id="${workout.id}" data-exercise-id="${exercise.id}" data-set-id="${set.id}" aria-label="عدد العدات"><input class="set-cell" type="number" min="0" step="0.5" value="${set.weight}" data-set-field="weight" data-workout-id="${workout.id}" data-exercise-id="${exercise.id}" data-set-id="${set.id}" aria-label="الوزن بالكيلوغرام"><button type="button" class="set-done ${set.completed ? 'done' : ''}" data-action="toggle-set" data-workout-id="${workout.id}" data-exercise-id="${exercise.id}" data-set-id="${set.id}" aria-label="${set.completed ? 'إلغاء إنجاز المجموعة' : 'إنجاز المجموعة'}">${set.completed ? '✓' : '○'}</button>`).join('')}
    </div></div>`).join('')}
    ${workout.notes ? `<p class="workout-notes">${escapeHtml(workout.notes)}</p>` : ''}
  </article>`;
}

function renderFitness() {
  const workouts = state.workouts.filter((workout) => workout.date === toDateKey(selectedDate));
  const allSets = workouts.flatMap((workout) => workout.exercises.flatMap((exercise) => exercise.sets));
  const doneSets = allSets.filter((set) => set.completed).length;
  mainContent.innerHTML = `
    <section class="page-intro"><div><span class="eyebrow">YOUR FITNESS SPACE</span><h1>مساحة الرياضة 🏋🏻‍♀️</h1><p>سجّلي جلساتك وتابعي تطورك مع الوقت.</p></div><button class="button button-primary" type="button" data-action="add-workout">＋ جلسة جديدة</button></section>
    <section class="fitness-hero"><h2>قوتك بتكبر مع كل تمرين 🌿</h2><p>سجّلي التمارين والمجموعات والعدات والأوزان، وتابعي إنجاز جلسة اليوم.</p></section>
    <section class="date-strip">${dateStripMarkup()}</section>
    <div class="fitness-summary"><div class="stat-card"><strong>${workouts.length}</strong><small>جلسات اليوم</small></div><div class="stat-card"><strong>${allSets.length}</strong><small>مجموعات</small></div><div class="stat-card"><strong>${doneSets}</strong><small>مكتملة</small></div></div>
    <div class="section-title"><div><h2>تمارين اليوم</h2><p>علّمي كل مجموعة بعد ما تخلصيها.</p></div></div>
    <section class="workout-list">${workouts.length ? workouts.map(workoutCardMarkup).join('') : `<div class="empty-state"><div class="empty-emoji">🌱</div><strong>ما في جلسة رياضية مسجلة لهاليوم</strong><small>ضيفي جلستك الأولى وخلي تقدمك واضح.</small></div>`}</section>`;
}

function habitHistoryMarkup(habit) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(selectedDate, index - 6);
    const isDue = isHabitDue(habit, day);
    const isDone = isHabitDone(habit, day);
    return `<span class="habit-history-day"><span>${WEEKDAYS[day.getDay()].short}</span><i class="${isDue && isDone ? 'done' : ''}">${isDue && isDone ? '✓' : isDue ? '·' : '–'}</i></span>`;
  }).join('');
}

function renderHabits() {
  const habits = state.habits.filter((habit) => !habit.archivedAt && isHabitDue(habit, selectedDate));
  const completed = habits.filter((habit) => isHabitDone(habit, selectedDate)).length;
  mainContent.innerHTML = `
    <section class="page-intro"><div><span class="eyebrow">SMALL THINGS, BIG CHANGE</span><h1>عاداتك اللطيفة ♡</h1><p>تابعي عاداتك الصغيرة يوماً بعد يوم.</p></div><button class="button button-primary" type="button" data-action="add-habit">＋ عادة جديدة</button></section>
    <section class="hero-card"><h2>مو لازم يكون يومك مثالياً 🌷</h2><p>الاستمرار بخطوات صغيرة أهم من الكمال.</p><div class="hero-progress"><div class="progress-track"><span style="width:${habits.length ? completed / habits.length * 100 : 0}%"></span></div><span class="progress-caption">${completed} من ${habits.length} عادات اليوم</span></div></section>
    <section class="date-strip">${dateStripMarkup()}</section>
    <div class="section-title"><div><h2>عادات اليوم</h2><p>علّمي العادة لما تنجزيها، وشوفي سلسلة التزامك.</p></div></div>
    <section class="habit-list">${habits.length ? habits.map((habit) => {
      const category = getCategory(habit.category);
      const streak = getHabitStreak(habit, selectedDate);
      return `<article class="habit-card"><div class="habit-icon">${category.icon}</div><div class="habit-main"><strong>${escapeHtml(habit.name)}</strong><small>${habit.type === 'daily' ? 'عادة يومية' : 'عادة أسبوعية'} · ${category.label}</small><div class="habit-progress"><span style="width:${Math.min(streak * 12, 100)}%"></span></div></div><span class="habit-streak">🔥 ${streak} أيام</span><button class="habit-check ${isHabitDone(habit, selectedDate) ? 'checked' : ''}" type="button" data-action="toggle-habit" data-id="${habit.id}" aria-label="تحديد إنجاز العادة">${isHabitDone(habit, selectedDate) ? '✓' : '○'}</button><button class="mini-action" type="button" data-action="edit-habit" data-id="${habit.id}" aria-label="تعديل العادة">✎</button><button class="mini-action danger" type="button" data-action="delete-habit" data-id="${habit.id}" aria-label="حذف العادة">×</button></article><div class="habit-history">${habitHistoryMarkup(habit)}</div>`;
    }).join('') : `<div class="empty-state"><div class="empty-emoji">🌼</div><strong>لسه ما أضفتي عادات لهاليوم</strong><small>اختاري عادة بسيطة وابدئي فيها على مهلك.</small></div>`}</section>`;
}

function render() {
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.page === currentPage));
  if (currentPage === 'home') renderHome();
  else if (currentPage === 'planner') renderPlanner();
  else if (currentPage === 'fitness') renderFitness();
  else if (currentPage === 'habits') renderHabits();
}

function setPage(page) {
  currentPage = page;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectDate(dateKey) {
  selectedDate = fromDateKey(dateKey);
  taskFilter = 'all';
  selectedCategory = 'all';
  render();
}

function populateCategorySelect(selectId, selected = 'other') {
  $(selectId).innerHTML = categoryOptions(selected);
}

function weekdayChoicesMarkup(containerId, selectedDays = []) {
  $(containerId).innerHTML = WEEKDAYS.map((day) => `<button type="button" class="weekday-choice ${selectedDays.includes(day.value) ? 'selected' : ''}" data-weekday="${day.value}">${day.short}</button>`).join('');
}

function selectedWeekdays(containerId) {
  return [...$(containerId).querySelectorAll('.weekday-choice.selected')].map((button) => Number(button.dataset.weekday));
}

function openDialog(dialogId) {
  const dialog = $(dialogId);
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialogId) {
  const dialog = $(dialogId);
  if (dialog.open) dialog.close();
}

function openTaskDialog(taskId = null) {
  editingTaskId = taskId;
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : null;
  const fields = task ? getTaskFieldsForDate(task, selectedDate) : { name: '', type: 'daily', days: [], date: toDateKey(selectedDate), category: 'other', priority: 'medium' };

  $('taskDialogTitle').textContent = task ? 'تعديل المهمة ✿' : 'مهمة جديدة ✿';
  $('taskName').value = fields.name;
  $('taskType').value = fields.type;
  populateCategorySelect('taskCategory', fields.category);
  $('taskPriority').value = fields.priority;
  $('taskDate').value = fields.date || toDateKey(selectedDate);
  weekdayChoicesMarkup('taskWeekdayChoices', fields.days);
  $('taskWeekdayField').hidden = fields.type !== 'weekly';
  $('taskDateField').hidden = fields.type !== 'once';
  $('taskEditScopeField').hidden = !task || fields.type === 'once';
  const occurrenceRadio = document.querySelector('input[name="taskEditScope"][value="occurrence"]');
  if (occurrenceRadio) occurrenceRadio.checked = true;
  openDialog('taskDialog');
  setTimeout(() => $('taskName').focus(), 50);
}

function readTaskForm() {
  const type = $('taskType').value;
  const days = type === 'weekly' ? selectedWeekdays('taskWeekdayChoices') : [];
  return {
    name: $('taskName').value.trim(),
    type,
    days,
    date: type === 'once' ? $('taskDate').value : '',
    category: $('taskCategory').value,
    priority: $('taskPriority').value
  };
}

function openDeleteTaskDialog(taskId) {
  deletingTaskId = taskId;
  const task = state.tasks.find((item) => item.id === taskId);
  const fields = task ? getTaskFieldsForDate(task, selectedDate) : null;
  $('deleteTaskDescription').textContent = fields ? `المهمة: ${fields.name} · ${formatDate(selectedDate)}` : '';
  const skipRadio = document.querySelector('input[name="deleteTaskScope"][value="skip"]');
  if (skipRadio) skipRadio.checked = true;
  openDialog('deleteTaskDialog');
}

function moveTask(taskId, direction) {
  const tasks = getTasksForDate(state, selectedDate);
  const ids = tasks.map((task) => task.id);
  const fromIndex = ids.indexOf(taskId);
  const toIndex = fromIndex + (direction === 'up' ? -1 : 1);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= ids.length) return;
  [ids[fromIndex], ids[toIndex]] = [ids[toIndex], ids[fromIndex]];
  reorderTasksForDate(state, selectedDate, ids);
  persist();
  renderHome();
}

function openHabitDialog(habitId = null) {
  editingHabitId = habitId;
  const habit = habitId ? state.habits.find((item) => item.id === habitId) : null;
  $('habitDialogTitle').textContent = habit ? 'تعديل العادة ♡' : 'عادة جديدة ♡';
  $('habitName').value = habit?.name || '';
  $('habitType').value = habit?.type || 'daily';
  populateCategorySelect('habitCategory', habit?.category || 'personal');
  weekdayChoicesMarkup('habitWeekdayChoices', habit?.days || []);
  $('habitWeekdayField').hidden = $('habitType').value !== 'weekly';
  openDialog('habitDialog');
  setTimeout(() => $('habitName').focus(), 50);
}

function addExerciseFormRow(exercise = null) {
  const row = document.createElement('div');
  row.className = 'exercise-form-row';
  row.innerHTML = `<div class="exercise-form-grid">
    <label class="field"><span>اسم التمرين</span><input data-exercise-field="name" value="${escapeHtml(exercise?.name || '')}" placeholder="Squats" required maxlength="60"></label>
    <label class="field"><span>Sets</span><input data-exercise-field="sets" type="number" min="1" max="20" value="${exercise?.sets?.length || 3}" required></label>
    <label class="field"><span>Reps</span><input data-exercise-field="reps" type="number" min="0" max="200" value="${exercise?.sets?.[0]?.reps ?? 12}" required></label>
    <label class="field"><span>Weight kg</span><input data-exercise-field="weight" type="number" min="0" max="1000" step="0.5" value="${exercise?.sets?.[0]?.weight ?? 0}" required></label>
  </div><button type="button" class="remove-exercise" data-action="remove-exercise" aria-label="حذف التمرين">إزالة التمرين ×</button>`;
  $('exerciseFormList').appendChild(row);
}

function openWorkoutDialog(workoutId = null) {
  editingWorkoutId = workoutId;
  const workout = workoutId ? state.workouts.find((item) => item.id === workoutId) : null;
  $('workoutDialogTitle').textContent = workout ? 'تعديل الجلسة ♧' : 'جلسة رياضية جديدة ♧';
  $('workoutTitle').value = workout?.title || '';
  $('workoutNotes').value = workout?.notes || '';
  $('exerciseFormList').innerHTML = '';
  if (workout?.exercises?.length) workout.exercises.forEach((exercise) => addExerciseFormRow(exercise));
  else addExerciseFormRow();
  openDialog('workoutDialog');
}

function saveWorkoutFromForm() {
  const rows = [...$('exerciseFormList').querySelectorAll('.exercise-form-row')];
  const exercises = rows.map((row) => {
    const value = (field) => row.querySelector(`[data-exercise-field="${field}"]`).value;
    const count = Math.min(20, Math.max(1, Number(value('sets')) || 1));
    const reps = Math.max(0, Number(value('reps')) || 0);
    const weight = Math.max(0, Number(value('weight')) || 0);
    return {
      name: value('name').trim(),
      sets: Array.from({ length: count }, () => ({ reps, weight, completed: false }))
    };
  }).filter((exercise) => exercise.name);

  if (!exercises.length) {
    showToast('أضيفي تمرين واحد على الأقل.');
    return null;
  }

  const input = { title: $('workoutTitle').value.trim(), notes: $('workoutNotes').value.trim(), exercises };
  if (!input.title) {
    showToast('اكتبي اسم الجلسة الرياضية.');
    return null;
  }

  if (editingWorkoutId) {
    const index = state.workouts.findIndex((item) => item.id === editingWorkoutId);
    if (index >= 0) state.workouts[index] = createWorkout(input, toDateKey(selectedDate), state.workouts[index]);
  } else {
    state.workouts.push(createWorkout(input, toDateKey(selectedDate)));
  }
  closeDialog('workoutDialog');
  persist('انحفظت جلستك الرياضية 🌿');
  renderFitness();
  return true;
}

function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === 'add-task') openTaskDialog();
  else if (action === 'edit-task') openTaskDialog(id);
  else if (action === 'toggle-task') {
    const task = state.tasks.find((item) => item.id === id);
    if (task) { toggleTaskDone(task, selectedDate); persist(); renderHome(); }
  } else if (action === 'delete-task') openDeleteTaskDialog(id);
  else if (action === 'move-task') moveTask(id, button.dataset.direction);
  else if (action === 'toggle-priority-sort') { prioritySort = !prioritySort; renderHome(); }
  else if (action === 'go-today') selectDate(toDateKey(new Date()));
  else if (action === 'previous-month') { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderPlanner(); }
  else if (action === 'next-month') { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderPlanner(); }
  else if (action === 'open-selected-day') setPage('home');
  else if (action === 'add-habit') openHabitDialog();
  else if (action === 'edit-habit') openHabitDialog(id);
  else if (action === 'toggle-habit') {
    const habit = state.habits.find((item) => item.id === id);
    if (habit) { toggleHabitDone(habit, selectedDate); persist(); renderHabits(); }
  } else if (action === 'delete-habit') {
    const habit = state.habits.find((item) => item.id === id);
    if (habit && window.confirm(`حذف عادة «${habit.name}» نهائياً؟`)) {
      state.habits = state.habits.filter((item) => item.id !== id);
      persist('انحذفت العادة.'); renderHabits();
    }
  } else if (action === 'add-workout') openWorkoutDialog();
  else if (action === 'delete-workout') {
    const workout = state.workouts.find((item) => item.id === id);
    if (workout && window.confirm(`حذف جلسة «${workout.title}»؟`)) {
      state.workouts = state.workouts.filter((item) => item.id !== id);
      persist('انحذفت الجلسة.'); renderFitness();
    }
  } else if (action === 'toggle-set') {
    const workout = state.workouts.find((item) => item.id === button.dataset.workoutId);
    if (workout) { toggleSetCompleted(workout, button.dataset.exerciseId, button.dataset.setId); persist(); renderFitness(); }
  } else if (action === 'add-set') {
    const workout = state.workouts.find((item) => item.id === button.dataset.workoutId);
    const exercise = workout?.exercises.find((item) => item.id === button.dataset.exerciseId);
    if (exercise) {
      const lastSet = exercise.sets.at(-1) || { reps: 10, weight: 0 };
      exercise.sets.push({ id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, reps: lastSet.reps, weight: lastSet.weight, completed: false });
      persist('انضافت مجموعة جديدة.');
      renderFitness();
    }
  } else if (action === 'delete-exercise') {
    const workout = state.workouts.find((item) => item.id === button.dataset.workoutId);
    if (workout && window.confirm('حذف هذا التمرين من الجلسة؟')) {
      workout.exercises = workout.exercises.filter((item) => item.id !== button.dataset.exerciseId);
      persist('انحذف التمرين من الجلسة.');
      renderFitness();
    }
  } else if (action === 'remove-exercise') {
    button.closest('.exercise-form-row')?.remove();
  }
}

// Main navigation and delegated page interactions.
document.querySelector('.bottom-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (button) setPage(button.dataset.page);
});

mainContent.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) { handleAction(actionButton); return; }

  const dateButton = event.target.closest('[data-date]');
  if (dateButton) { selectDate(dateButton.dataset.date); return; }

  const calendarButton = event.target.closest('[data-calendar-date]');
  if (calendarButton) {
    selectedDate = fromDateKey(calendarButton.dataset.calendarDate);
    if (selectedDate.getMonth() !== calendarCursor.getMonth()) calendarCursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    renderPlanner();
    return;
  }

  const taskFilterButton = event.target.closest('[data-task-filter]');
  if (taskFilterButton) { taskFilter = taskFilterButton.dataset.taskFilter; renderHome(); return; }

  const categoryFilterButton = event.target.closest('[data-category-filter]');
  if (categoryFilterButton) { selectedCategory = categoryFilterButton.dataset.categoryFilter; renderHome(); }
});

mainContent.addEventListener('change', (event) => {
  const setInput = event.target.closest('[data-set-field]');
  if (!setInput) return;
  const workout = state.workouts.find((item) => item.id === setInput.dataset.workoutId);
  const exercise = workout?.exercises.find((item) => item.id === setInput.dataset.exerciseId);
  const set = exercise?.sets.find((item) => item.id === setInput.dataset.setId);
  if (!set) return;
  const value = Math.max(0, Number(setInput.value) || 0);
  set[setInput.dataset.setField] = value;
  persist('انحفظ تعديل المجموعة.');
});

// Native drag-and-drop for larger screens, plus arrow controls for touch devices.
mainContent.addEventListener('dragstart', (event) => {
  const card = event.target.closest('[data-task-card]');
  if (!card || prioritySort) return;
  draggedTaskId = card.dataset.taskCard;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedTaskId);
});
mainContent.addEventListener('dragover', (event) => {
  if (event.target.closest('[data-task-card]')) event.preventDefault();
});
mainContent.addEventListener('drop', (event) => {
  const target = event.target.closest('[data-task-card]');
  if (!target || !draggedTaskId || draggedTaskId === target.dataset.taskCard) return;
  event.preventDefault();
  const tasks = getTasksForDate(state, selectedDate);
  const ids = tasks.map((task) => task.id).filter((id) => id !== draggedTaskId);
  const targetIndex = ids.indexOf(target.dataset.taskCard);
  ids.splice(targetIndex, 0, draggedTaskId);
  reorderTasksForDate(state, selectedDate, ids);
  draggedTaskId = null;
  persist();
  renderHome();
});

// Task dialog controls.
$('taskType').addEventListener('change', () => {
  const type = $('taskType').value;
  $('taskWeekdayField').hidden = type !== 'weekly';
  $('taskDateField').hidden = type !== 'once';
  $('taskEditScopeField').hidden = !editingTaskId || type === 'once';
});
$('taskWeekdayChoices').addEventListener('click', (event) => {
  const button = event.target.closest('[data-weekday]');
  if (button) button.classList.toggle('selected');
});
$('taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = readTaskForm();
  if (!fields.name) return;
  if (fields.type === 'weekly' && !fields.days.length) { showToast('اختاري يوم واحد على الأقل.'); return; }
  if (fields.type === 'once' && !fields.date) { showToast('حددي تاريخ المهمة.'); return; }

  if (editingTaskId) {
    const task = state.tasks.find((item) => item.id === editingTaskId);
    if (task) {
      const scope = document.querySelector('input[name="taskEditScope"]:checked')?.value || 'occurrence';
      if (scope === 'future' && getTaskFieldsForDate(task, selectedDate).type !== 'once') editTaskFromDate(task, selectedDate, fields);
      else editTaskOccurrence(task, selectedDate, fields);
    }
  } else {
    state.tasks.push(createTask(fields, selectedDate));
  }

  closeDialog('taskDialog');
  persist('انحفظت المهمة بنجاح 💗');
  render();
});
$('deleteTaskForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const task = state.tasks.find((item) => item.id === deletingTaskId);
  if (!task) { closeDialog('deleteTaskDialog'); return; }
  const scope = document.querySelector('input[name="deleteTaskScope"]:checked')?.value || 'skip';
  if (scope === 'skip') skipTaskForDate(task, selectedDate);
  else if (scope === 'future') endTaskFromDate(task, selectedDate);
  else state.tasks = state.tasks.filter((item) => item.id !== deletingTaskId);
  closeDialog('deleteTaskDialog');
  persist(scope === 'skip' ? 'تم تخطي المهمة لهذا اليوم فقط 🌷' : 'تم تحديث قائمة المهام.');
  render();
});

// Habit dialog controls.
$('habitType').addEventListener('change', () => { $('habitWeekdayField').hidden = $('habitType').value !== 'weekly'; });
$('habitWeekdayChoices').addEventListener('click', (event) => {
  const button = event.target.closest('[data-weekday]');
  if (button) button.classList.toggle('selected');
});
$('habitForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = {
    name: $('habitName').value.trim(),
    type: $('habitType').value,
    days: $('habitType').value === 'weekly' ? selectedWeekdays('habitWeekdayChoices') : [],
    category: $('habitCategory').value
  };
  if (!input.name) return;
  if (input.type === 'weekly' && !input.days.length) { showToast('اختاري يوم واحد على الأقل.'); return; }

  if (editingHabitId) {
    const habit = state.habits.find((item) => item.id === editingHabitId);
    if (habit) Object.assign(habit, input);
  } else {
    state.habits.push(createHabit(input, selectedDate));
  }
  closeDialog('habitDialog');
  persist('انحفظت عادتك الجديدة ♡');
  renderHabits();
});

// Workout dialog controls.
$('addExerciseButton').addEventListener('click', () => addExerciseFormRow());
$('workoutForm').addEventListener('submit', (event) => {
  event.preventDefault();
  saveWorkoutFromForm();
});

// Close controls shared by all dialogs.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-close-dialog]');
  if (button) closeDialog(button.dataset.closeDialog);
});

if (stateResult.migrated) showToast('نقلنا مهامك القديمة للتخزين المحلي الجديد 💗');
if (!stateResult.storageAvailable) showToast('التخزين المحلي غير متاح حالياً. افتحي الموقع عبر Safari مع السماح ببيانات المواقع.');

render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed:', error));
}
