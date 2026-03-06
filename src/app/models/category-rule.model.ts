import {User} from '@models/auth.model';
import {Category} from '@models/category.model';

export interface CategoryRule {
  id: number;
  user: User;
  keyword: string;
  priority: number;
  category: Category;
}

export interface CategoryRuleRequest {
  keyword: string;
  priority: number;
  categoryId: number;
}
