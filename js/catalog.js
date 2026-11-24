export const CATEGORIES = [
  { id: 'study', label: 'الدراسة والجامعة', icon: '📚', className: 'category-study' },
  { id: 'work', label: 'البرمجة والعمل', icon: '💻', className: 'category-work' },
  { id: 'fitness', label: 'الرياضة', icon: '🏋🏻‍♀️', className: 'category-fitness' },
  { id: 'selfcare', label: 'العناية بالنفس', icon: '🧴', className: 'category-selfcare' },
  { id: 'home', label: 'المنزل', icon: '🏡', className: 'category-home' },
  { id: 'personal', label: 'شخصي', icon: '🎀', className: 'category-personal' },
  { id: 'other', label: 'أخرى', icon: '🌷', className: 'category-other' }
];

export const PRIORITIES = [
  { id: 'high', label: 'عالية', className: 'priority-high' },
  { id: 'medium', label: 'متوسطة', className: 'priority-medium' },
  { id: 'low', label: 'منخفضة', className: 'priority-low' }
];

export function getCategory(categoryId) {
  return CATEGORIES.find((category) => category.id === categoryId) || CATEGORIES.at(-1);
}

export function getPriority(priorityId) {
  return PRIORITIES.find((priority) => priority.id === priorityId) || PRIORITIES[1];
}

export function categoryOptions(selected = 'other') {
  return CATEGORIES.map((category) => `<option value="${category.id}" ${category.id === selected ? 'selected' : ''}>${category.icon} ${category.label}</option>`).join('');
}
