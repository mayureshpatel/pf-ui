export const CATEGORY_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
  'bg-yellow-500',
  'bg-cyan-500'
];

const CATEGORY_COLOR_HEX: Record<string, string> = {
  'bg-blue-500': '#3B82F6',
  'bg-green-500': '#10B981',
  'bg-purple-500': '#8B5CF6',
  'bg-orange-500': '#F97316',
  'bg-pink-500': '#EC4899',
  'bg-teal-500': '#14B8A6',
  'bg-indigo-500': '#6366F1',
  'bg-red-500': '#EF4444',
  'bg-yellow-500': '#EAB308',
  'bg-cyan-500': '#06B6D4'
};

/**
 * Generate a consistent color for a category name using hash-based selection
 */
export function getCategoryColor(categoryName: string): string {
  if (!categoryName) {
    return CATEGORY_COLORS[0];
  }

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index];
}

/**
 * Get hex color for a category (for charts)
 */
export function getCategoryColorHex(categoryName: string): string {
  const tailwindClass = getCategoryColor(categoryName);
  return CATEGORY_COLOR_HEX[tailwindClass] || CATEGORY_COLOR_HEX[CATEGORY_COLORS[0]];
}

/**
 * Get PrimeNG severity for tag styling based on category color
 */
export function getCategorySeverity(categoryName: string): string {
  const color = getCategoryColor(categoryName);

  const severityMap: Record<string, string> = {
    'bg-blue-500': 'info',
    'bg-green-500': 'success',
    'bg-purple-500': 'secondary',
    'bg-orange-500': 'warn',
    'bg-pink-500': 'danger',
    'bg-teal-500': 'info',
    'bg-indigo-500': 'secondary',
    'bg-red-500': 'danger',
    'bg-yellow-500': 'warn',
    'bg-cyan-500': 'info'
  };

  return severityMap[color] || 'secondary';
}
