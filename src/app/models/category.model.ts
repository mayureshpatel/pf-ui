export interface Category {
  id: number;
  name: string;
}

export interface CategoryFormData {
  name: string;
}

export interface CategoryWithUsage extends Category {
  transactionCount: number;
}
