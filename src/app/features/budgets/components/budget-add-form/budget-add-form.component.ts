import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectItemGroup } from 'primeng/api';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { Category } from '@models/category.model';

/** The panel's add mode: pick a category that has no limit this month and set one. */
@Component({
  selector: 'app-budget-add-form',
  standalone: true,
  imports: [ReactiveFormsModule, SelectModule, InputNumberModule],
  templateUrl: './budget-add-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetAddFormComponent {
  /** Categories without a budget this month. */
  readonly categories: InputSignal<Category[]> = input.required<Category[]>();

  readonly save: OutputEmitterRef<{ categoryId: number; amount: number }> = output<{
    categoryId: number;
    amount: number;
  }>();

  readonly form = new FormGroup({
    categoryId: new FormControl<number | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  /** Parents under "Main categories", each parent's children under "<Parent> subcategories". */
  readonly categoryGroups: Signal<SelectItemGroup[]> = computed((): SelectItemGroup[] => {
    const all: Category[] = this.categories();
    const parents: Category[] = all.filter((c: Category): boolean => !c.parent);
    const children: Category[] = all.filter((c: Category): boolean => !!c.parent);
    const groups: SelectItemGroup[] = [];
    if (parents.length > 0) {
      groups.push({
        label: 'Main categories',
        items: parents.map((p: Category) => ({ label: p.name, value: p.id })),
      });
    }
    const parentNames = new Map<number, string>();
    children.forEach((c: Category): void => {
      if (c.parent) parentNames.set(c.parent.id, c.parent.name);
    });
    parentNames.forEach((name: string, parentId: number): void => {
      groups.push({
        label: `${name} subcategories`,
        items: children
          .filter((c: Category): boolean => c.parent?.id === parentId)
          .map((c: Category) => ({ label: c.name, value: c.id })),
      });
    });
    return groups;
  });

  /** Submits from outside (the panel's Add budget button). */
  submit(): void {
    this.form.markAllAsTouched();
    if (this.categories().length === 0 || this.form.invalid) return;
    const { categoryId, amount } = this.form.getRawValue();
    this.save.emit({ categoryId: categoryId!, amount: amount! });
  }
}
