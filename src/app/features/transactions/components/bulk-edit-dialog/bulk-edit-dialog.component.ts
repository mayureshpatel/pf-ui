import {Component, effect, inject, input, InputSignal, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl} from '@angular/forms';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {CheckboxModule} from 'primeng/checkbox';
import {SelectModule} from 'primeng/select';
import {SelectItemGroup} from 'primeng/api';
import {Transaction} from '@models/transaction.model';
import {CategoryApiService} from '../../../categories/services/category-api.service';
import {Category, CategoryGroup} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

export interface BulkEditData {
  updateCategory: boolean;
  category?: Category;
  updateMerchant: boolean;
  merchant?: Merchant;
  updateDescription: boolean;
  description?: string;
}

@Component({
  selector: 'app-bulk-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    CheckboxModule,
    SelectModule
  ],
  templateUrl: './bulk-edit-dialog.component.html'
})
export class BulkEditDialogComponent {
  private readonly categoryApi = inject(CategoryApiService);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();
  transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();
  saving: InputSignal<boolean> = input<boolean>(false);

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  save: OutputEmitterRef<BulkEditData> = output<BulkEditData>();

  form = new FormGroup({
    updateCategory: new FormControl<boolean>(false, { nonNullable: true }),
    category: new FormControl<Category | null>(null),
    updateVendor: new FormControl<boolean>(false, { nonNullable: true }),
    merchant: new FormControl<string>('', { nonNullable: true }),
    updateDescription: new FormControl<boolean>(false, { nonNullable: true }),
    description: new FormControl<string>('', { nonNullable: true })
  });

  categoryGroups: WritableSignal<SelectItemGroup[]> = signal<SelectItemGroup[]>([]);

  constructor() {
    this.loadCategories();

    effect((): void => {
      if (!this.visible()) {
        this.resetForm();
      }
    });
  }

  private loadCategories(): void {
    this.categoryApi.getGroupedCategories().subscribe({
      next: (groups: CategoryGroup[]): void => {
        const selectGroups: SelectItemGroup[] = groups.map((g: CategoryGroup) => ({
          label: g.groupLabel,
          items: g.items.map((c: Category) => ({
            label: c.name,
            value: c
          }))
        }));
        this.categoryGroups.set(selectGroups);
      }
    });
  }

  get transactionCount(): number {
    return this.transactions().length;
  }

  get isLargeUpdate(): boolean {
    return this.transactionCount > 100;
  }

  get isValid(): boolean {
    const v = this.form.getRawValue();
    const hasAtLeastOneField = v.updateCategory || v.updateVendor || v.updateDescription;
    if (!hasAtLeastOneField) return false;
    if (v.updateCategory && !v.category) return false;
    if (v.updateVendor && !v.merchant?.trim()) return false;
    if (v.updateDescription && !v.description?.trim()) return false;
    return true;
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  onSave(): void {
    if (!this.isValid) return;

    const v = this.form.getRawValue();
    const data: BulkEditData = {
      updateCategory: v.updateCategory,
      category: v.category ?? undefined,
      updateMerchant: v.updateVendor,
      merchant: v.merchant ? { cleanName: v.merchant } as Merchant : undefined,
      updateDescription: v.updateDescription,
      description: v.description?.trim()
    };

    this.save.emit(data);
  }

  private resetForm(): void {
    this.form.reset({
      updateCategory: false,
      category: null,
      updateVendor: false,
      merchant: '',
      updateDescription: false,
      description: ''
    });
  }
}
