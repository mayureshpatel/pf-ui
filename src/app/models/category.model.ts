export interface Category {
  id: number;
  name: string;
  color?: string;
}

export interface CategoryFormData {
  name: string;
  color?: string;
}

export interface CategoryWithUsage extends Category {
  transactionCount: number;
}
