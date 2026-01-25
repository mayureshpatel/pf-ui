export interface Category {
  id: number;
  name: string;
  color?: string;
  parentId?: number;
  parentName?: string;
}

export interface CategoryFormData {
  name: string;
  color?: string;
  parentId?: number;
}

export interface CategoryWithUsage extends Category {
  transactionCount: number;
}
