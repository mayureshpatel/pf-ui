import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { getCategoryColor } from '@shared/utils/category.utils';
import { toCents } from '@shared/utils/money.utils';
import {
  BudgetGroupKey,
  BudgetRow,
  BudgetRowGroup,
  isUnbudgeted,
  usedPercent,
} from '../../utils/budget-helpers';

/** The month's categories in three groups. It renders what it is given and owns no data. */
@Component({
  selector: 'app-budget-list',
  standalone: true,
  imports: [FormatCurrencyPipe],
  templateUrl: './budget-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetListComponent {
  readonly groups: InputSignal<BudgetRowGroup[]> = input.required<BudgetRowGroup[]>();
  readonly selectedCategoryId: InputSignal<number | null> = input.required<number | null>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();

  readonly openCategory: OutputEmitterRef<BudgetRow> = output<BudgetRow>();

  readonly categoryColor = getCategoryColor;
  readonly isUnbudgeted = isUnbudgeted;

  /** What is left (positive) or over (negative) for a row, in cents. */
  left(row: BudgetRow): number {
    return toCents(row.status.budgetedAmount - row.status.spentAmount);
  }

  /** Width of the bar, capped at 100%. */
  width(row: BudgetRow): number {
    return Math.min(usedPercent(row.status), 100);
  }

  /** Tailwind background class for a bar in the given group. */
  barClass(key: BudgetGroupKey): string {
    // -700 on the light track and -400 on the dark one keep each fill at 3:1 or more against it
    return key === 'OVER'
      ? 'bg-rose-700 dark:bg-rose-400'
      : key === 'CLOSE'
        ? 'bg-amber-700 dark:bg-amber-400'
        : 'bg-emerald-700 dark:bg-emerald-400';
  }
}
