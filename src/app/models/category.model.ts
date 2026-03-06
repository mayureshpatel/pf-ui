export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  BOTH = 'BOTH',
  TRANSFER = 'TRANSFER'
}

export interface Category {
  id: number;
  userId: number;
  name: string;
  categoryType: CategoryType;
  parent: Category | null;
  icon: string | null;
  color: string | null;
}

export interface CategoryFormData {
  name: string;
  type?: string;
  color?: string;
  icon?: string;
  parentId?: number;
}

export interface CategoryWithUsage extends Category {
  transactionCount: number;
}

export interface CategoryGroup {
  groupLabel: string;
  groupId: number;
  items: Category[];
}

/** Convenience: extract a display color from a Category */
export function getCategoryDisplayColor(category: Category | null | undefined, fallback: string = 'bg-gray-300'): string {
  return category?.color ?? fallback;
}
