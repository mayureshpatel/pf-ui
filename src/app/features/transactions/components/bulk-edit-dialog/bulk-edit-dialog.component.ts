import {
  ChangeDetectionStrategy,
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
import {toSignal} from '@angular/core/rxjs-interop';
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
import {MerchantApiService} from '@features/merchants/services/merchant-api.service';
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
  templateUrl: './bulk-edit-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkEditDialogComponent {
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);

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
    merchant: new FormControl<Merchant | null>(null),
    updateDescription: new FormControl<boolean>(false, {nonNullable: true}),
    description: new FormControl<string>('', {nonNullable: true})
  });

  /** Hierarchical category groups for the dropdown. */
  readonly categoryGroups: WritableSignal<SelectItemGroup[]> = signal([]);

  /** Merchant options for the reassignment dropdown. */
  readonly merchantOptions: WritableSignal<{ label: string, value: Merchant }[]> = signal([]);

  /** Total number of transactions in the current batch. */
  readonly transactionCount: Signal<number> = computed(() => this.transactions().length);

  /** Indicates if the batch size is large enough to warrant an explicit warning. */
  readonly isLargeUpdate: Signal<boolean> = computed(() => this.transactionCount() > 50);

  /**
   * A signal mirror of the form's own value. `computed()` only tracks Signal reads as
   * dependencies -- reading `this.form.value` directly inside a computed (as `isValid` used to)
   * creates no reactive dependency at all, so it would compute once on first read and then never
   * change again for the lifetime of the component, regardless of any later form edits.
   */
  private readonly formValue = toSignal(this.form.valueChanges, {initialValue: this.form.getRawValue()});

  /**
   * Evaluates the logical validity of the bulk form.
   * Ensures at least one toggle is active and its associated field is populated.
   */
  readonly isValid: Signal<boolean | undefined> = computed((): boolean | undefined => {
    const v = this.formValue();
    const hasCategory: boolean = v.updateCategory ? !!v.category : false;
    const hasVendor: boolean = v.updateVendor ? !!v.merchant : false;
    const hasDesc: boolean = v.updateDescription ? !!v.description?.trim() : false;

    const anyToggle: boolean | undefined = v.updateCategory || v.updateVendor || v.updateDescription;
    const allActiveAreFilled: boolean = (!v.updateCategory || hasCategory) &&
      (!v.updateVendor || hasVendor) &&
      (!v.updateDescription || hasDesc);

    return anyToggle && allActiveAreFilled;
  });

  constructor() {
    this.loadCategories();
    this.loadMerchants();

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
          label: g.parent.name ?? 'Uncategorized',
          items: g.items.map((c: Category) => ({label: c.name, value: c}))
        }));
        this.categoryGroups.set(selectGroups);
      }
    });
  }

  /**
   * Fetches the full merchant list for reassignment.
   */
  private loadMerchants(): void {
    this.merchantApi.getMerchants().subscribe({
      next: (merchants: Merchant[]): void => {
        this.merchantOptions.set(merchants.map((m: Merchant) => ({
          label: m.cleanName || m.originalName || 'Unknown Merchant',
          value: m
        })));
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
      merchant: v.merchant ?? undefined,
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
      merchant: null,
      updateDescription: false,
      description: ''
    });
  }
}
