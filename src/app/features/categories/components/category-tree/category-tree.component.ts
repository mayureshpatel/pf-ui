import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { Category } from '@models/category.model';
import { getCategoryColor } from '@shared/utils/category.utils';
import { CategoryNode, isUnused } from '../../utils/category-helpers';

/**
 * The categories as an indented tree. It renders what it is given (already filtered) and owns no
 * state: expansion, ticks and selection come in as inputs and go out as events.
 */
@Component({
  selector: 'app-category-tree',
  standalone: true,
  templateUrl: './category-tree.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryTreeComponent {
  readonly nodes: InputSignal<CategoryNode[]> = input.required<CategoryNode[]>();
  readonly expandedIds: InputSignal<ReadonlySet<number>> = input.required<ReadonlySet<number>>();
  readonly selectedCategoryId: InputSignal<number | null> = input.required<number | null>();
  /** Ids that may be ticked right now. */
  readonly tickable: InputSignal<ReadonlySet<number>> = input.required<ReadonlySet<number>>();
  readonly ticked: InputSignal<ReadonlySet<number>> = input.required<ReadonlySet<number>>();
  readonly showChecks: InputSignal<boolean> = input.required<boolean>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();

  readonly openCategory: OutputEmitterRef<Category> = output<Category>();
  readonly toggleExpand: OutputEmitterRef<number> = output<number>();
  readonly toggleTick: OutputEmitterRef<number> = output<number>();
  readonly expandAll: OutputEmitterRef<void> = output<void>();
  readonly collapseAll: OutputEmitterRef<void> = output<void>();

  readonly color = (category: Category): string =>
    category.color || getCategoryColor(category.name);

  /** What the count column shows for a parent: the group's total, or Unused when it has none. */
  parentCount(node: CategoryNode): number | null {
    return node.totalCount === 0 ? null : node.totalCount;
  }

  /** What the count column shows for a subcategory. */
  childCount(category: Category): number | null {
    return isUnused(category) ? null : (category.transactionCount ?? 0);
  }

  subcategoryLabel(count: number): string {
    return count === 1 ? '1 subcategory' : `${count} subcategories`;
  }
}
