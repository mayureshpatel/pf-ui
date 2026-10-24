import { Category, CategoryType } from '@models/category.model';

/** A top-level category with its subcategories and the transactions across the whole group. */
export interface CategoryNode {
  parent: Category;
  children: Category[];
  /** The parent's own transactions plus its children's. */
  totalCount: number;
}

export interface CategoryFilter {
  type: 'ALL' | CategoryType;
  unusedOnly: boolean;
  search: string;
}

export const NO_FILTER: CategoryFilter = { type: 'ALL', unusedOnly: false, search: '' };

export interface CategoryStats {
  categories: number;
  groups: number;
  transactions: number;
  unused: number;
}

const byName = (a: Category, b: Category): number =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Groups categories under their parents. Each category's `transactionCount` becomes its own count
 * (0 when `counts` has none); a node's `totalCount` adds the children's.
 *
 * @param categories - Every category, flat.
 * @param counts - Categories carrying their own transaction counts.
 */
export function buildNodes(categories: Category[], counts: Category[]): CategoryNode[] {
  const own = new Map<number, number>(counts.map((c: Category) => [c.id, c.transactionCount ?? 0]));
  const withCounts: Category[] = categories.map((c: Category): Category => ({
    ...c,
    transactionCount: own.get(c.id) ?? 0,
  }));
  return withCounts
    .filter((c: Category): boolean => !c.parent)
    .sort(byName)
    .map((parent: Category): CategoryNode => {
      const children: Category[] = withCounts
        .filter((c: Category): boolean => c.parent?.id === parent.id)
        .sort(byName);
      const totalCount: number = children.reduce(
        (sum: number, c: Category): number => sum + (c.transactionCount ?? 0),
        parent.transactionCount ?? 0,
      );
      return { parent, children, totalCount };
    });
}

/** A category with no transactions of its own. */
export function isUnused(category: Category): boolean {
  return (category.transactionCount ?? 0) === 0;
}

/** Whether any filter or search narrows the tree. */
export function isFiltering(filter: CategoryFilter): boolean {
  return filter.type !== 'ALL' || filter.unusedOnly || filter.search.trim() !== '';
}

const matches = (category: Category, filter: CategoryFilter): boolean => {
  const search: string = filter.search.trim().toLowerCase();
  return (
    (filter.type === 'ALL' || category.type === filter.type) &&
    (!filter.unusedOnly || isUnused(category)) &&
    (search === '' || category.name.toLowerCase().includes(search))
  );
};

/**
 * Applies the filters. A subcategory shows when it matches; a parent shows when it matches itself
 * or when any of its subcategories do, so a match is never orphaned.
 *
 * @param nodes - The unfiltered tree.
 * @param filter - Type, unused-only and search.
 */
export function filterNodes(nodes: CategoryNode[], filter: CategoryFilter): CategoryNode[] {
  return nodes
    .map((node: CategoryNode) => ({
      node,
      children: node.children.filter((c: Category): boolean => matches(c, filter)),
    }))
    .filter(({ node, children }) => matches(node.parent, filter) || children.length > 0)
    .map(({ node, children }): CategoryNode => ({ ...node, children }));
}

/** The type pills to offer: Expense and Income always, Both and Transfer when one exists. */
export function availableTypes(categories: Category[]): CategoryType[] {
  const present = new Set<CategoryType>(categories.map((c: Category): CategoryType => c.type));
  return [
    CategoryType.EXPENSE,
    CategoryType.INCOME,
    CategoryType.BOTH,
    CategoryType.TRANSFER,
  ].filter(
    (type: CategoryType): boolean =>
      type === CategoryType.EXPENSE || type === CategoryType.INCOME || present.has(type),
  );
}

/** Totals for the overview. */
export function categoryStats(categories: Category[]): CategoryStats {
  return {
    categories: categories.length,
    groups: categories.filter((c: Category): boolean => !c.parent).length,
    transactions: categories.reduce(
      (sum: number, c: Category): number => sum + (c.transactionCount ?? 0),
      0,
    ),
    unused: categories.filter(isUnused).length,
  };
}

/**
 * Whether a row may be ticked for deletion: it is unused and, for a parent with subcategories,
 * every subcategory is ticked too (the backend refuses a parent that still has children).
 */
export function isTickable(
  category: Category,
  nodes: CategoryNode[],
  ticked: ReadonlySet<number>,
): boolean {
  if (!isUnused(category)) return false;
  const node: CategoryNode | undefined = nodes.find(
    (n: CategoryNode) => n.parent.id === category.id,
  );
  return !node || node.children.every((c: Category): boolean => ticked.has(c.id));
}

/** Deletion levels to run in sequence: subcategories first, then parents (empty levels omitted). */
export function deleteOrder(ids: number[], categories: Category[]): number[][] {
  const known: Category[] = categories.filter((c: Category): boolean => ids.includes(c.id));
  return [
    known.filter((c: Category): boolean => !!c.parent),
    known.filter((c: Category): boolean => !c.parent),
  ]
    .map((level: Category[]): number[] => level.map((c: Category): number => c.id))
    .filter((level: number[]): boolean => level.length > 0);
}

/** The categories that may be chosen as a parent for `editing` (null when adding). */
export function parentOptions(categories: Category[], editing: Category | null): Category[] {
  if (editing && categories.some((c: Category): boolean => c.parent?.id === editing.id)) {
    return [];
  }
  return categories.filter((c: Category): boolean => !c.parent && c.id !== editing?.id);
}
