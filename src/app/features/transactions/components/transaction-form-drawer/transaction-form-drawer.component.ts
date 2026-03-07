import {
  Component,
  computed,
  effect,
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
import {AutoCompleteModule} from 'primeng/autocomplete';
import {ButtonModule} from 'primeng/button';
import {InputNumberModule} from 'primeng/inputnumber';
import {InputTextModule} from 'primeng/inputtext';
import {SelectModule} from 'primeng/select';
import {DatePicker} from 'primeng/datepicker';
import {MessageModule} from 'primeng/message';

import {
  Transaction,
  TransactionCreateRequest,
  TransactionType,
  TransactionUpdateRequest
} from '@models/transaction.model';
import {Account} from '@models/account.model';
import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';

/**
 * Drawer component for creating or editing individual ledger transactions.
 *
 * Implements a signal-first architecture for reactive form synchronization
 * and features intelligent autocomplete for merchants and categories.
 */
@Component({
  selector: 'app-transaction-form-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AutoCompleteModule,
    ButtonModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    DatePicker,
    MessageModule,
    DrawerComponent
  ],
  templateUrl: './transaction-form-drawer.component.html'
})
export class TransactionFormDrawerComponent {
  /** Two-way binding for drawer visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The transaction being edited, or null for creation mode. */
  readonly transaction: InputSignal<Transaction | null> = input<Transaction | null>(null);

  /** Available bank accounts for transaction association. */
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();

  /** Available categories for classification. */
  readonly categories: InputSignal<Category[]> = input.required<Category[]>();

  /** Known merchants for autocomplete suggestions. */
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();

  /** Indicates if a save operation is in flight. */
  readonly saving: InputSignal<boolean> = input(false);

  /** Emitted when the form is validated and ready for persistence. */
  readonly save: OutputEmitterRef<TransactionCreateRequest | TransactionUpdateRequest> = output<TransactionCreateRequest | TransactionUpdateRequest>();

  /** Filtered suggestions for the category autocomplete. */
  readonly filteredCategories: WritableSignal<Category[]> = signal([]);

  /** Filtered suggestions for the merchant autocomplete. */
  readonly filteredMerchants: WritableSignal<Merchant[]> = signal([]);

  /** Options for the transaction type selector. */
  readonly typeOptions = [
    {label: 'Expense', value: TransactionType.EXPENSE, icon: 'pi-minus-circle', color: 'text-rose-500'},
    {label: 'Income', value: TransactionType.INCOME, icon: 'pi-plus-circle', color: 'text-emerald-500'},
    {label: 'Transfer', value: TransactionType.TRANSFER, icon: 'pi-sync', color: 'text-surface-500'}
  ];

  /**
   * Strongly typed reactive form for transaction details.
   */
  readonly form = new FormGroup({
    id: new FormControl<number | null>({value: null, disabled: true}),
    accountId: new FormControl<number>({value: 0, disabled: true}, {nonNullable: true, validators: [Validators.required]}),
    amount: new FormControl<number>(0, {nonNullable: true, validators: [Validators.required, Validators.min(0.01)]}),
    transactionDate: new FormControl<string>('', {nonNullable: true, validators: [Validators.required]}),
    description: new FormControl<string>(''),
    type: new FormControl<TransactionType>(TransactionType.EXPENSE, {
      nonNullable: true,
      validators: [Validators.required]
    }),
    categoryId: new FormControl<number | null>(null),
    postDate: new FormControl<string | null>(null),
    merchantId: new FormControl<number | null>(null)
  });

  /** Indicates if the component is in edit mode. */
  readonly isEditMode: Signal<boolean> = computed((): boolean => this.transaction() !== null);

  /** Title displayed in the drawer header. */
  readonly drawerTitle: Signal<string> = computed((): string => this.isEditMode() ? 'Edit Transaction' : 'New Transaction');

  constructor() {
    /**
     * Core effect to synchronize the form state whenever the input transaction changes
     * or the drawer is opened.
     */
    effect((): void => {
      const txn: Transaction | null = this.transaction();
      const isVisible: boolean = this.visible();

      if (isVisible) {
        if (txn) {
          this.form.patchValue({
            transactionDate: txn.date instanceof Date ? txn.date.toISOString().split('T')[0] : txn.date,
            amount: Math.abs(txn.amount),
            description: txn.description,
            type: txn.type,
            categoryId: txn.category.id,
            merchantId: txn.merchant.id,
            accountId: txn.account.id
          });
        } else {
          this.form.reset({
            transactionDate: new Date().toISOString().split('T')[0],
            amount: 0,
            type: TransactionType.EXPENSE,
            description: ''
          });
        }
      }
    });
  }

  /**
   * Closes the drawer.
   */
  onHide(): void {
    this.visible.set(false);
  }

  /**
   * Filters the category list based on user input.
   */
  filterCategories(event: any): void {
    const query: any = event.query.toLowerCase();
    this.filteredCategories.set(
      this.categories().filter((c: Category): any => c.name.toLowerCase().includes(query))
    );
  }

  /**
   * Filters the merchant list based on user input.
   */
  filterMerchants(event: any): void {
    const query: any = event.query.toLowerCase();
    this.filteredMerchants.set(
      this.merchants().filter((m: Merchant): boolean => m.cleanName.toLowerCase().includes(query))
    );
  }

  /**
   * Validates and submits the form data.
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const rawValue = this.form.getRawValue();
    const selectedTransaction: Transaction | null = this.transaction();

    if (selectedTransaction) {
      const updateRequest: TransactionUpdateRequest = {
        id: selectedTransaction.id,
        accountId: rawValue.accountId,
        amount: rawValue.amount,
        transactionDate: rawValue.transactionDate,
        description: rawValue.description ?? '',
        type: rawValue.type,
        categoryId: rawValue.categoryId!,
        postDate: rawValue.postDate!,
        merchantId: rawValue.merchantId!
      }

      this.save.emit(updateRequest);
    } else {
      const createRequest: TransactionCreateRequest = {
        accountId: rawValue.accountId,
        amount: rawValue.amount,
        transactionDate: rawValue.transactionDate,
        description: rawValue.description ?? '',
        type: rawValue.type,
        categoryId: rawValue.categoryId!,
        postDate: rawValue.postDate!,
        merchantId: rawValue.merchantId!
      }

      this.save.emit(createRequest);
    }
  }
}
