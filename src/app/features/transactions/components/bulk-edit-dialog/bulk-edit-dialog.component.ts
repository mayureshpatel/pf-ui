import {Component, effect, input, InputSignal, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
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
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    CheckboxModule,
    SelectModule
  ],
  templateUrl: './bulk-edit-dialog.component.html'
})
export class BulkEditDialogComponent {
  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();
  transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();
  saving: InputSignal<boolean> = input<boolean>(false);

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  save: OutputEmitterRef<BulkEditData> = output<BulkEditData>();

  // state
  updateCategory: WritableSignal<boolean> = signal(false);
  category: WritableSignal<Category | undefined> = signal<Category | undefined>(undefined);
  updateVendor: WritableSignal<boolean> = signal(false);
  merchant: WritableSignal<Merchant | undefined> = signal<Merchant | undefined>(undefined);
  updateDescription: WritableSignal<boolean> = signal(false);
  description: WritableSignal<string | undefined> = signal<string | undefined>(undefined);

  categoryGroups: WritableSignal<SelectItemGroup[]> = signal<SelectItemGroup[]>([]);

  constructor(private readonly categoryApi: CategoryApiService) {
    // Load categories on init
    this.loadCategories();

    // Reset form when dialog visibility changes
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
            value: c.name
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
    const hasAtLeastOneField: boolean = this.updateCategory() || this.updateVendor() || this.updateDescription();
    if (!hasAtLeastOneField) return false;

    if (this.updateCategory() && !this.category()) return false;
    if (this.updateVendor() && !this.merchant()) return false;
    if (this.updateDescription() && !this.description()?.trim()) return false;

    return true;
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  onSave(): void {
    if (!this.isValid) return;

    const data: BulkEditData = {
      updateCategory: this.updateCategory(),
      category: this.category(),
      updateMerchant: this.updateVendor(),
      merchant: this.merchant(),
      updateDescription: this.updateDescription(),
      description: this.description()?.trim()
    };

    this.save.emit(data);
  }

  private resetForm(): void {
    this.updateCategory.set(false);
    this.category.set(undefined);
    this.updateVendor.set(false);
    this.merchant.set(undefined);
    this.updateDescription.set(false);
    this.description.set(undefined);
  }
}
