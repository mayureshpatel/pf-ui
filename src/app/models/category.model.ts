import {User} from '@models/auth.model';
import {Iconography} from '@models/iconography.model';

export enum CategoryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  BOTH = 'BOTH',
  TRANSFER = 'TRANSFER'
}

export interface Category {
  id: number;
  user: User;
  name: string;
  iconography: Iconography;
  type: CategoryType;
  parent: Category;
}

export interface CategoryFormData {
  name: string;
  iconography?: Iconography;
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
