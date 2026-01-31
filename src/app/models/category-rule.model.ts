export interface CategoryRule {
  id: number;
  keyword: string;
  categoryName: string;
  priority: number;
}

export interface CategoryRuleDto {
  keyword: string;
  categoryName: string;
  priority?: number;
}
