import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { SelectItemGroup } from 'primeng/api';
import { Transaction } from '../../../../models/transaction.model';
import { CategoryApiService } from '../../../categories/services/category-api.service';
import {Category} from '@models/category.model';
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
  // Inputs
  visible = input.required<boolean>();
  transactions = input.required<Transaction[]>();
  saving = input<boolean>(false);

  // Outputs
  visibleChange = output<boolean>();
  save = output<BulkEditData>();

  // Form state
  updateCategory = signal(false);
  category = signal<Category | undefined>(undefined);
  updateVendor = signal(false);
  merchant = signal<Merchant | undefined>(undefined);
  updateDescription = signal(false);
  description = signal<string | undefined>(undefined);

  // Category groups for dropdown
  categoryGroups = signal<SelectItemGroup[]>([]);

  constructor(private readonly categoryApi: CategoryApiService) {
    // Load categories on init
    this.loadCategories();

    // Reset form when dialog visibility changes
    effect(() => {
      if (!this.visible()) {
        this.resetForm();
      }
    });
  }

  private loadCategories(): void {
    this.categoryApi.getGroupedCategories().subscribe({
      next: (groups) => {
        const selectGroups: SelectItemGroup[] = groups.map(g => ({
          label: g.groupLabel,
          items: g.items.map(c => ({
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
    const hasAtLeastOneField = this.updateCategory() || this.updateVendor() || this.updateDescription();
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
