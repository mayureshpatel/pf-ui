import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { Category, CategoryType } from '@models/category.model';
import { getCategoryColor } from '@shared/utils/category.utils';
import { CategoryNode, isUnused } from '../../utils/category-helpers';

/**
 * The categories as an indented tree. It renders what it is given (already filtered) and owns no
 * state: expansion, ticks and selection come in as inputs and go out as events.
 */
@Component({
  selector: 'app-category-tree',
  standalone: true,
  imports: [DecimalPipe],
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
  /** Why each disabled checkbox is disabled, by category id (worked out on the unfiltered tree). */
  readonly reasons: InputSignal<ReadonlyMap<number, string>> = input<ReadonlyMap<number, string>>(
    new Map(),
  );
  readonly showChecks: InputSignal<boolean> = input.required<boolean>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();
  /**
   * A filter or search is active. The tree then shows every match expanded, so the expand and
   * collapse controls have nothing to do and are switched off.
   */
  readonly filtering: InputSignal<boolean> = input<boolean>(false);

  readonly openCategory: OutputEmitterRef<Category> = output<Category>();
  readonly toggleExpand: OutputEmitterRef<number> = output<number>();
  readonly toggleTick: OutputEmitterRef<number> = output<number>();
  readonly expandAll: OutputEmitterRef<void> = output<void>();
  readonly collapseAll: OutputEmitterRef<void> = output<void>();

  readonly color = (category: Category): string =>
    category.color || getCategoryColor(category.name);

  /** What the count column shows for a parent: the group's total, or Unused when it has none. */
  /** A parent shows its group total (0 included); only a parent with nothing under it can read Unused. */
  parentCount(node: CategoryNode): number | null {
    return node.children.length === 0 && node.totalCount === 0 ? null : node.totalCount;
  }

  /** The name a type adds under a category (Expense is the default and is not repeated). */
  typeLabel(category: Category): string | null {
    switch (category.type) {
      case CategoryType.INCOME:
        return 'Income';
      case CategoryType.BOTH:
        return 'Both';
      case CategoryType.TRANSFER:
        return 'Transfer';
      default:
        return null;
    }
  }

  /** Why a checkbox is disabled, or null when it is not. */
  reason(category: Category): string | null {
    return this.tickable().has(category.id) ? null : (this.reasons().get(category.id) ?? null);
  }

  /** The checkbox's accessible name, with the reason when it is disabled. */
  checkLabel(category: Category): string {
    const why: string | null = this.reason(category);
    return why ? `Select ${category.name} (not available: ${why})` : `Select ${category.name}`;
  }

  /** What the count column shows for a subcategory. */
  childCount(category: Category): number | null {
    return isUnused(category) ? null : (category.transactionCount ?? 0);
  }

  /**
   * A checkbox flips itself when clicked, but only the host decides whether the tick counts (it may
   * be refused, for example while an edit is unsaved). Put the box back to what the inputs say
   * before emitting; if the host accepts, the binding ticks it again.
   */
  onTick(event: Event, id: number): void {
    (event.target as HTMLInputElement).checked = this.ticked().has(id);
    this.toggleTick.emit(id);
  }

  /** The unit a screen reader hears after a count ("1 transaction", "5 transactions"). */
  unit(count: number | null): string {
    return count === 1 ? ' transaction' : ' transactions';
  }

  subcategoryLabel(count: number): string {
    return count === 1 ? '1 subcategory' : `${count} subcategories`;
  }
}
