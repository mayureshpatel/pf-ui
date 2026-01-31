export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  BOTH = 'BOTH'
}

export interface Category {
  id: number;
  name: string;
  color?: string;
  icon?: string;
  type?: CategoryType;
  parentId?: number;
  parentName?: string;
}

export interface CategoryFormData {
  name: string;
  color?: string;
  icon?: string;
  type?: CategoryType;
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
