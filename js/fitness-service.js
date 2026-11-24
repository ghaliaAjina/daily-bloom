import { createId } from './date-utils.js';

export function createWorkout(input, date, existing = null) {
  const exercises = (input.exercises || []).map((exercise) => ({
    id: exercise.id || createId(),
    name: String(exercise.name || '').trim(),
    sets: (exercise.sets || []).map((set) => ({
      id: set.id || createId(),
      reps: Math.max(0, Number(set.reps) || 0),
      weight: Math.max(0, Number(set.weight) || 0),
      completed: Boolean(set.completed)
    }))
  })).filter((exercise) => exercise.name);

  return {
    id: existing?.id || createId(),
    date: existing?.date || date,
    title: String(input.title || '').trim(),
    notes: String(input.notes || '').trim(),
    exercises,
    createdAt: existing?.createdAt || new Date().toISOString()
  };
}

export function getWorkoutStats(workout) {
  const sets = workout.exercises.flatMap((exercise) => exercise.sets);
  return {
    exerciseCount: workout.exercises.length,
    totalSets: sets.length,
    completedSets: sets.filter((set) => set.completed).length
  };
}

export function toggleSetCompleted(workout, exerciseId, setId) {
  const exercise = workout.exercises.find((item) => item.id === exerciseId);
  const set = exercise?.sets.find((item) => item.id === setId);
  if (set) set.completed = !set.completed;
}
