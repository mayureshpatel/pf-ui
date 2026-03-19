export const CATEGORY_COLORS: string[] = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#EF4444', // Red
  '#EAB308', // Yellow
  '#06B6D4'  // Cyan
];

/**
 * Generate a consistent color for a category name using hash-based selection
 *
 * @param categoryName The name of the category
 * @returns The Hex color for the category color
 */
export function getCategoryColor(categoryName: string): string {
  if (!categoryName) {
    return CATEGORY_COLORS[0];
  }

  let hash: number = 0;
  for (let i: number = 0; i < categoryName.length; i++) {
    hash = (categoryName.codePointAt(i) || 0) + ((hash << 5) - hash);
  }

  const index: number = Math.abs(hash) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index];
}
