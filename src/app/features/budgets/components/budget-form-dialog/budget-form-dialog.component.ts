import {
  Component,
  computed,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {SelectModule} from 'primeng/select';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {SelectItemGroup} from 'primeng/api';

import {Category} from '@models/category.model';
import {BudgetApiService} from '../../services/budget-api.service';
import {ToastService} from '@core/services/toast.service';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';

/**
 * Drawer component for setting and updating category budgets.
 *
 * Groups categories into Parent/Child structures for easier selection
 * and validates budget amounts before submission.
 *
 * A `p-dialog` originally, migrated to `DrawerComponent` by PF-803 -- PrimeNG 21.1.3's `p-select`
 * silently fails to register a clicked option when hosted inside a `p-dialog` (confirmed via live
 * e2e testing across mouse click, force-click, raw coordinates, and keyboard selection, all
 * failing identically with no console error). The identical `formControlName` + `p-select`
 * pattern works correctly inside `app-drawer`, so migrating the container -- not the form itself
 * -- was the fix. PrimeNG's repository is archived (2026-06-28) with no further fixes coming to
 * this version line, ruling out waiting for an upstream patch.
 */
@Component({
  selector: 'app-budget-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    SelectModule,
    InputNumberModule,
    MessageModule,
    DrawerComponent
  ],
  templateUrl: './budget-form-dialog.component.html'
})
export class BudgetFormDialogComponent {
  private readonly budgetApi: BudgetApiService = inject(BudgetApiService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for the dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The list of available categories to choose from. */
  readonly categories: InputSignal<Category[]> = input.required<Category[]>();

  /** The month for which the budget is being set. */
  readonly month: InputSignal<number> = input.required<number>();

  /** The year for which the budget is being set. */
  readonly year: InputSignal<number> = input.required<number>();

  /** Emitted when a budget is successfully saved. */
  readonly save: OutputEmitterRef<void> = output<void>();

  /** Indicates if a save operation is in progress. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Holds API error messages for display. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Reactive form for capturing budget details.
   */
  readonly form = new FormGroup({
    categoryId: new FormControl<number | null>(null, {
      validators: [Validators.required]
    }),
    amount: new FormControl<number | null>(null, {
      validators: [Validators.required, Validators.min(0)]
    })
  });

  /**
   * Derived signal that groups categories into SelectItemGroups for the dropdown.
   */
  readonly categoryGroups: Signal<SelectItemGroup[]> = computed((): SelectItemGroup[] => {
    const allCategories: Category[] = this.categories();
    const parents: Category[] = allCategories.filter((c: Category): boolean => !c.parent);
    const children: Category[] = allCategories.filter((c: Category): Category | null => c.parent);

    const groups: SelectItemGroup[] = [];

    // parent categories that can be budgeted
    if (parents.length > 0) {
      groups.push({
        label: 'Main Categories',
        items: parents.map((p: Category) => ({label: p.name, value: p.id}))
      });
    }

    // sub-categories that can be budgeted
    parents.forEach((parent: Category): void => {
      const subCats: Category[] = children.filter((c: Category): boolean => c.parent?.id === parent.id);
      if (subCats.length > 0) {
        groups.push({
          label: `${parent.name} (Sub-categories)`,
          items: subCats.map((c: Category) => ({label: c.name, value: c.id}))
        });
      }
    });

    return groups;
  });

  /**
   * Resets the form whenever the drawer is shown.
   */
  onShow(): void {
    this.form.reset();
    this.errorMessage.set(null);
  }

  /**
   * Validates and submits the budget form to the API.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.loading()) {
      return;
    }

    const {categoryId, amount} = this.form.getRawValue();

    // verify category exists in local state
    const categoryExists: boolean = this.categories().some((c: Category): boolean => c.id === categoryId);
    if (!categoryExists) {
      this.errorMessage.set('Selected category is no longer valid.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.budgetApi.createBudget(categoryId!, amount!, this.month(), this.year())
      .pipe(finalize((): void => this.loading.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success('Budget saved successfully');
          this.save.emit();
          this.visible.set(false);
        },
        error: (err: any): void => {
          console.error('Error saving budget:', err);
          this.errorMessage.set(err.error?.detail || 'Failed to save budget. Please try again.');
        }
      });
  }
}
