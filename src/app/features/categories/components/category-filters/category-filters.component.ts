import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { CategoryType } from '@models/category.model';
import { CategoryFilter } from '../../utils/category-helpers';

const TYPE_LABELS: Record<CategoryType, string> = {
  [CategoryType.EXPENSE]: 'Expense',
  [CategoryType.INCOME]: 'Income',
  [CategoryType.BOTH]: 'Both',
  [CategoryType.TRANSFER]: 'Transfer',
};

/** Type pills, the Unused pill and the search box. It owns no state: it emits the whole filter. */
@Component({
  selector: 'app-category-filters',
  standalone: true,
  templateUrl: './category-filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFiltersComponent {
  readonly filter: InputSignal<CategoryFilter> = input.required<CategoryFilter>();
  readonly types: InputSignal<CategoryType[]> = input.required<CategoryType[]>();
  readonly unusedCount: InputSignal<number> = input.required<number>();

  readonly filterChange: OutputEmitterRef<CategoryFilter> = output<CategoryFilter>();

  label(type: CategoryType): string {
    return TYPE_LABELS[type];
  }

  setType(type: 'ALL' | CategoryType): void {
    this.filterChange.emit({ ...this.filter(), type });
  }

  toggleUnused(): void {
    this.filterChange.emit({ ...this.filter(), unusedOnly: !this.filter().unusedOnly });
  }

  setSearch(event: Event): void {
    this.filterChange.emit({ ...this.filter(), search: (event.target as HTMLInputElement).value });
  }

  /** Tailwind classes for a pill, filled when pressed. */
  pillClass(pressed: boolean): string {
    return pressed
      ? 'bg-primary-700 text-white border-primary-700'
      : 'border-surface-300 dark:border-surface-700';
  }
}
