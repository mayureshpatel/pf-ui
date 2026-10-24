import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { toCents } from '@shared/utils/money.utils';
import { BudgetRow, isUnbudgeted } from '../../utils/budget-helpers';

/** The panel's category mode: edit this month's limit, jump to the transactions, or remove it. */
@Component({
  selector: 'app-budget-category-view',
  standalone: true,
  imports: [ReactiveFormsModule, InputNumberModule, FormatCurrencyPipe],
  templateUrl: './budget-category-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetCategoryViewComponent {
  readonly row: InputSignal<BudgetRow> = input.required<BudgetRow>();
  readonly monthName: InputSignal<string> = input.required<string>();
  readonly saving: InputSignal<boolean> = input<boolean>(false);

  readonly save: OutputEmitterRef<number> = output<number>();
  readonly remove: OutputEmitterRef<void> = output<void>();
  readonly viewTransactions: OutputEmitterRef<void> = output<void>();

  readonly form = new FormGroup({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  /** Whether this category has spending but no limit yet. */
  readonly unbudgeted: Signal<boolean> = computed((): boolean => isUnbudgeted(this.row()));

  /** What is left (positive) or over (negative), in cents. */
  readonly left: Signal<number> = computed((): number =>
    toCents(this.row().status.budgetedAmount - this.row().status.spentAmount),
  );

  /**
   * Which category is shown, and whether it has a budget yet. The form resets only when this
   * changes (a different category, or the same one just getting its first budget), not on a
   * background refresh that keeps both the same.
   */
  private readonly formKey: Signal<string> = computed(
    (): string => `${this.row().status.category.id}:${this.row().budgetId ?? 'none'}`,
  );

  constructor() {
    effect((): void => {
      this.formKey();
      untracked((): void => {
        this.form.reset({
          amount: isUnbudgeted(this.row()) ? null : this.row().status.budgetedAmount,
        });
      });
    });
  }

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.save.emit(this.form.getRawValue().amount!);
  }
}
