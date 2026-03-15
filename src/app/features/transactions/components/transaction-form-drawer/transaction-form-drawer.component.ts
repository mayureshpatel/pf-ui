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
import {finalize, forkJoin} from 'rxjs';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {MerchantApiService} from '@features/merchants/services/merchant-api.service';
import {ProgressSpinner} from 'primeng/progressspinner';

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
    DrawerComponent,
    ProgressSpinner
  ],
  templateUrl: './transaction-form-drawer.component.html'
})
export class TransactionFormDrawerComponent {
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);

  /** Two-way binding for drawer visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The transaction being edited, or null for creation mode. */
  readonly transaction: InputSignal<Transaction | null> = input<Transaction | null>(null);

  /** Indicates if a save operation is in flight. */
  readonly saving: InputSignal<boolean> = input(false);

  /** Indicates if the drawer is currently loading data. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Emitted when the form is validated and ready for persistence. */
  readonly save: OutputEmitterRef<TransactionCreateRequest | TransactionUpdateRequest> = output<TransactionCreateRequest | TransactionUpdateRequest>();

  /** Available bank accounts for transaction association. */
  readonly accounts: WritableSignal<Account[]> = signal<Account[]>([]);

  /** Available categories for classification. */
  readonly categories: WritableSignal<Category[]> = signal<Category[]>([]);

  /** Known merchants for autocomplete suggestions. */
  readonly merchants: WritableSignal<Merchant[]> = signal<Merchant[]>([]);

  /** Error message to display. */
  readonly errorMessage: WritableSignal<string | null> = signal(null);

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
    accountId: new FormControl<number>(0, {nonNullable: true, validators: [Validators.required]}),
    amount: new FormControl<number>(0, {nonNullable: true, validators: [Validators.required, Validators.min(0.01)]}),
    transactionDate: new FormControl<string>('', {nonNullable: true, validators: [Validators.required]}),
    description: new FormControl<string>('', {nonNullable: true}),
    type: new FormControl<TransactionType>(TransactionType.EXPENSE, {
      nonNullable: true,
      validators: [Validators.required]
    }),
    category: new FormControl<Category | null>(null, {validators: [Validators.required]}),
    postDate: new FormControl<string | null>(null),
    merchant: new FormControl<Merchant | null>(null)
  });

  /** Indicates if the component is in edit mode. */
  readonly isEditMode: Signal<boolean> = computed((): boolean => this.transaction() !== null);

  /** Title displayed in the drawer header. */
  readonly drawerTitle: Signal<string> = computed((): string => this.isEditMode() ? 'Edit Transaction' : 'New Transaction');

  /** Reactive signal bridge for the merchant form control value. */
  private readonly selectedMerchant: WritableSignal<Merchant | null> = signal<Merchant | null>(null);

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);

    forkJoin({
      categories: this.categoryApi.getCategories(),
      accounts: this.accountApi.getAccounts(),
      merchants: this.merchantApi.getMerchants(),
    })
      .pipe(
        takeUntilDestroyed(),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: ({categories, accounts, merchants}) => {
          this.categories.set(categories);
          this.accounts.set(accounts);
          this.merchants.set(merchants);

          this.filteredCategories.set(categories);
          this.filteredMerchants.set(merchants);
        },
        error: (error) => {
          console.error('Error loading data:', error);
        }
      });
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

  onShow(): void {
    this.form.reset();
    this.errorMessage.set(null);

    const transaction: Transaction | null = this.transaction();

    if (transaction) {
      this.form.patchValue({
        transactionDate: transaction.date instanceof Date ? transaction.date.toISOString().split('T')[0] : transaction.date,
        amount: Math.abs(transaction.amount),
        description: transaction.description,
        type: transaction.type,
        category: transaction.category,
        merchant: transaction.merchant,
        accountId: transaction.account.id
      });
    } else {
      this.form.patchValue({
        transactionDate: new Date().toISOString().split('T')[0],
        amount: 0,
        description: '',
        type: TransactionType.EXPENSE,
        category: null,
        merchant: null,
        accountId: 0
      });
    }
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
        categoryId: rawValue.category?.id!,
        postDate: rawValue.postDate!,
        merchantId: rawValue.merchant?.id!
      }

      this.save.emit(updateRequest);
    } else {
      const createRequest: TransactionCreateRequest = {
        accountId: rawValue.accountId,
        amount: rawValue.amount,
        transactionDate: rawValue.transactionDate,
        description: rawValue.description ?? '',
        type: rawValue.type,
        categoryId: rawValue.category?.id!,
        postDate: rawValue.postDate!,
        merchantId: rawValue.merchant?.id!
      }

      this.save.emit(createRequest);
    }
  }
}
