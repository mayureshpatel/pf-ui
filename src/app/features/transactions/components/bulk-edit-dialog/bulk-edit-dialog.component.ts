import {
  Component,
  computed,
  effect,
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
import {FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {CheckboxModule} from 'primeng/checkbox';
import {SelectModule} from 'primeng/select';
import {SelectItemGroup} from 'primeng/api';
import {MessageModule} from 'primeng/message';

import {Transaction} from '@models/transaction.model';
import {CategoryApiService} from '../../../categories/services/category-api.service';
import {Category, CategoryGroup} from '@models/category.model';
import {Merchant} from '@models/merchant.model';

/**
 * Data structure for finalized bulk edit operations.
 */
export interface BulkEditData {
  updateCategory: boolean;
  category?: Category;
  updateMerchant: boolean;
  merchant?: Merchant;
  updateDescription: boolean;
  description?: string;
}

/**
 * Dialog for mass-modifying multiple transactions simultaneously.
 *
 * Allows users to selectively toggle which fields (Category, Merchant, Description)
 * should be updated across all selected items in the ledger.
 */
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
    SelectModule,
    MessageModule
  ],
  templateUrl: './bulk-edit-dialog.component.html'
})
export class BulkEditDialogComponent {
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);

  /** Two-way binding for dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The list of transactions currently targeted for mass-edit. */
  readonly transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();

  /** Indicates if a bulk save operation is in flight. */
  readonly saving: InputSignal<boolean> = input<boolean>(false);

  /** Emitted when the user confirms the mass-edit changes. */
  readonly save: OutputEmitterRef<BulkEditData> = output<BulkEditData>();

  /**
   * Strongly typed form for mass-update configuration.
   */
  readonly form = new FormGroup({
    updateCategory: new FormControl<boolean>(false, {nonNullable: true}),
    category: new FormControl<Category | null>(null),
    updateVendor: new FormControl<boolean>(false, {nonNullable: true}),
    merchant: new FormControl<string>('', {nonNullable: true}),
    updateDescription: new FormControl<boolean>(false, {nonNullable: true}),
    description: new FormControl<string>('', {nonNullable: true})
  });

  /** Hierarchical category groups for the dropdown. */
  readonly categoryGroups: WritableSignal<SelectItemGroup[]> = signal([]);

  /** Total number of transactions in the current batch. */
  readonly transactionCount: Signal<number> = computed(() => this.transactions().length);

  /** Indicates if the batch size is large enough to warrant an explicit warning. */
  readonly isLargeUpdate: Signal<boolean> = computed(() => this.transactionCount() > 50);

  /**
   * Evaluates the logical validity of the bulk form.
   * Ensures at least one toggle is active and its associated field is populated.
   */
  readonly isValid: Signal<boolean | undefined> = computed((): boolean | undefined => {
    const v = this.form.value;
    const hasCategory: boolean = v.updateCategory ? !!v.category : false;
    const hasVendor: boolean = v.updateVendor ? !!v.merchant?.trim() : false;
    const hasDesc: boolean = v.updateDescription ? !!v.description?.trim() : false;

    const anyToggle: boolean | undefined = v.updateCategory || v.updateVendor || v.updateDescription;
    const allActiveAreFilled: boolean = (!v.updateCategory || hasCategory) &&
      (!v.updateVendor || hasVendor) &&
      (!v.updateDescription || hasDesc);

    return anyToggle && allActiveAreFilled;
  });

  constructor() {
    this.loadCategories();

    /**
     * Effect to handle dialog reset logic.
     */
    effect((): void => {
      if (!this.visible()) {
        this.resetForm();
      }
    });
  }

  /**
   * Fetches the category tree for assignment.
   */
  private loadCategories(): void {
    this.categoryApi.getGroupedCategories().subscribe({
      next: (groups: CategoryGroup[]): void => {
        const selectGroups = groups.map((g: CategoryGroup) => ({
          label: g.groupLabel,
          items: g.items.map((c: Category) => ({label: c.name, value: c}))
        }));
        this.categoryGroups.set(selectGroups);
      }
    });
  }

  /**
   * Resets the dialog state.
   */
  onCancel(): void {
    this.visible.set(false);
  }

  /**
   * Finalizes the mass-edit configuration and emits the payload.
   */
  onSave(): void {
    if (!this.isValid()) return;

    const v = this.form.getRawValue();
    this.save.emit({
      updateCategory: v.updateCategory,
      category: v.category || undefined,
      updateMerchant: v.updateVendor,
      merchant: v.merchant ? {cleanName: v.merchant} as Merchant : undefined,
      updateDescription: v.updateDescription,
      description: v.description?.trim()
    });
  }

  /**
   * Resets the dialog state.
   */
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
