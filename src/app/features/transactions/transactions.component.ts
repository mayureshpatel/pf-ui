import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {skip} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {TooltipModule} from 'primeng/tooltip';
import {Select} from 'primeng/select';
import {CheckboxModule} from 'primeng/checkbox';
import {TagModule} from 'primeng/tag';
import {DatePicker} from 'primeng/datepicker';
import {AutoComplete, AutoCompleteCompleteEvent} from 'primeng/autocomplete';
import {InputNumberModule} from 'primeng/inputnumber';
import {InputTextModule} from 'primeng/inputtext';
import {ConfirmationService, MenuItem} from 'primeng/api';
import {ContextMenuModule} from 'primeng/contextmenu';
import {
  PageResponse,
  Transaction,
  TransactionCreateRequest,
  TransactionFilter,
  TransactionFormData,
  TransactionType,
  TransactionUpdateRequest
} from '@models/transaction.model';
import {Account} from '@models/account.model';
import {Category} from '@models/category.model';
import {TransactionApiService} from './services/transaction-api.service';
import {TransactionFormDrawerComponent} from './components/transaction-form-drawer/transaction-form-drawer.component';
import {CsvImportDialogComponent} from './components/csv-import-dialog/csv-import-dialog.component';
import {BulkEditDialogComponent} from './components/bulk-edit-dialog/bulk-edit-dialog.component';
import {
  TransferMatchingDialogComponent
} from './components/transfer-matching-dialog/transfer-matching-dialog.component';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {convertDateString} from '@shared/utils/transaction.utils';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {TableToolbarComponent} from '@shared/components/table-toolbar/table-toolbar';
import {Merchant} from '@models/merchant.model';
import {FormatTransactionTypeAmountPipe} from '@shared/pipes/format-transaction-type-amount.pipe';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    CardModule,
    TooltipModule,
    Select,
    CheckboxModule,
    TagModule,
    DatePicker,
    AutoComplete,
    InputNumberModule,
    InputTextModule,
    ContextMenuModule,
    ScreenToolbarComponent,
    TableToolbarComponent,
    TransactionFormDrawerComponent,
    CsvImportDialogComponent,
    BulkEditDialogComponent,
    TransferMatchingDialogComponent,
    FormatTransactionTypeAmountPipe
  ],
  templateUrl: './transactions.component.html'
})
export class TransactionsComponent implements OnInit, OnDestroy {
  // injected services
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  // state
  transactions: WritableSignal<Transaction[]> = signal([]);
  accounts: WritableSignal<Account[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  showImportDialog: WritableSignal<boolean> = signal(false);
  showBulkEditDialog: WritableSignal<boolean> = signal(false);
  showTransferDialog: WritableSignal<boolean> = signal(false);

  selectedTransaction: WritableSignal<Transaction | null> = signal(null);
  selectedTransactions: WritableSignal<Transaction[]> = signal([]);

  // context menu state
  contextMenuItems: MenuItem[] = [];
  selectedContextTransaction: Transaction | null = null;

  savingTransaction: WritableSignal<boolean> = signal(false);
  savingBulkEdit: WritableSignal<boolean> = signal(false);

  // pagination
  currentPage: WritableSignal<number> = signal(0);
  pageSize: WritableSignal<number> = signal(20);
  totalRecords: WritableSignal<number> = signal(0);

  // quick filters
  filterAccountId: WritableSignal<number | null> = signal(null);
  filterType: WritableSignal<TransactionType | null> = signal(null);
  filterDateRange: WritableSignal<Date[] | null> = signal(null);

  // advanced filters
  showAdvancedFilters: WritableSignal<boolean> = signal(false);
  filterDescription: WritableSignal<string> = signal('');
  filterMerchant: WritableSignal<string> = signal('');
  filterCategoryName: WritableSignal<string> = signal('');
  filterMinAmount: WritableSignal<number | null> = signal(null);
  filterMaxAmount: WritableSignal<number | null> = signal(null);

  // sorting
  currentSort: WritableSignal<string> = signal('date,desc');

  // autocomplete data
  categories: WritableSignal<Category[]> = signal([]);
  filteredCategories: WritableSignal<string[]> = signal([]);
  merchants: WritableSignal<Merchant[]> = signal([]);
  filteredVendors: WritableSignal<Merchant[]> = signal([]);

  // guard to prevent double-load when we navigate internally
  private skipNextQueryParamUpdate = false;

  // computed signals
  isEmpty: Signal<boolean> = computed((): boolean => this.transactions().length === 0 && !this.loading());
  allSelected: Signal<boolean> = computed((): boolean =>
    this.selectedTransactions().length === this.transactions().length &&
    this.transactions().length > 0
  );

  activeFilterCount: Signal<number> = computed((): number => {
    let count: number = 0;
    if (this.filterAccountId()) count++;
    if (this.filterType()) count++;
    if (this.filterDateRange()) count++;
    if (this.filterDescription()) count++;
    if (this.filterMerchant()) count++;
    if (this.filterCategoryName()) count++;
    if (this.filterMinAmount() !== null) count++;
    if (this.filterMaxAmount() !== null) count++;
    return count;
  });

  hasAdvancedFilters: Signal<boolean> = computed((): boolean =>
    !!this.filterDescription() ||
    !!this.filterMerchant() ||
    !!this.filterCategoryName() ||
    this.filterMinAmount() !== null ||
    this.filterMaxAmount() !== null
  );

  // utility functions
  formatDate = convertDateString;

  // dropdown options
  transactionTypes = [
    {label: 'All Types', value: null},
    {label: 'Income', value: TransactionType.INCOME},
    {label: 'Expense', value: TransactionType.EXPENSE},
    {label: 'Transfer (All)', value: TransactionType.TRANSFER},
    {label: 'Transfer In', value: TransactionType.TRANSFER_IN},
    {label: 'Transfer Out', value: TransactionType.TRANSFER_OUT}
  ];

  accountOptions = computed(() => {
    const accounts: Account[] = this.accounts();
    return [
      {label: 'All Accounts', value: null},
      ...accounts.map((a: Account) => ({label: a.name, value: a.id}))
    ];
  });

  ngOnInit(): void {
    // Hydrate filter state from URL on initial load
    this.hydrateFromParams(this.route.snapshot.queryParams);

    // Handle external navigation (e.g., dashboard → /transactions?category=Food)
    this.route.queryParams
      .pipe(
        skip(1), // skip the initial emission, already handled via snapshot
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((params: Params): void => {
        if (this.skipNextQueryParamUpdate) {
          this.skipNextQueryParamUpdate = false;
          return;
        }
        this.hydrateFromParams(params);
        this.loadTransactions();
      });

    this.loadCategories();
    this.loadMerchants();
    this.loadAccounts();
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.transactions.set([]);
    this.selectedTransactions.set([]);
    this.categories.set([]);
    this.accounts.set([]);
    this.filteredCategories.set([]);
    this.filteredVendors.set([]);
  }

  private hydrateFromParams(params: Params): void {
    this.filterAccountId.set(params['accountId'] ? Number(params['accountId']) : null);
    this.filterType.set((params['type'] as TransactionType) ?? null);
    this.filterDescription.set(params['description'] ?? '');
    this.filterMerchant.set(params['merchant'] ?? '');
    this.filterCategoryName.set(params['categoryName'] ?? '');
    this.filterMinAmount.set(params['minAmount'] != null ? Number(params['minAmount']) : null);
    this.filterMaxAmount.set(params['maxAmount'] != null ? Number(params['maxAmount']) : null);
    this.currentSort.set(params['sort'] ?? 'date,desc');
    this.currentPage.set(params['page'] ? Number(params['page']) : 0);
    this.pageSize.set(params['size'] ? Number(params['size']) : 20);

    if (params['startDate'] && params['endDate']) {
      this.filterDateRange.set([new Date(params['startDate']), new Date(params['endDate'])]);
    } else {
      this.filterDateRange.set(null);
    }

    if (this.hasAdvancedFilters()) {
      this.showAdvancedFilters.set(true);
    }
  }

  private updateUrlParams(): void {
    const queryParams: Params = {};

    const accountId = this.filterAccountId();
    if (accountId !== null) queryParams['accountId'] = accountId;

    const type = this.filterType();
    if (type) queryParams['type'] = type;

    const description = this.filterDescription();
    if (description) queryParams['description'] = description;

    const merchant = this.filterMerchant();
    if (merchant) queryParams['merchant'] = merchant;

    const categoryName = this.filterCategoryName();
    if (categoryName) queryParams['categoryName'] = categoryName;

    const minAmount = this.filterMinAmount();
    if (minAmount !== null) queryParams['minAmount'] = minAmount;

    const maxAmount = this.filterMaxAmount();
    if (maxAmount !== null) queryParams['maxAmount'] = maxAmount;

    const dateRange = this.filterDateRange();
    if (dateRange?.length === 2 && dateRange[0] && dateRange[1]) {
      queryParams['startDate'] = this.toISODate(dateRange[0]);
      queryParams['endDate'] = this.toISODate(dateRange[1]);
    }

    if (this.currentPage() > 0) queryParams['page'] = this.currentPage();
    if (this.pageSize() !== 20) queryParams['size'] = this.pageSize();
    if (this.currentSort() !== 'date,desc') queryParams['sort'] = this.currentSort();

    this.skipNextQueryParamUpdate = true;
    this.router.navigate([], { queryParams, queryParamsHandling: 'replace', replaceUrl: true });
  }

  loadAccounts(): void {
    this.accountApi.getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (accounts: Account[]): void => {
          this.accounts.set(accounts);
        },
        error: (error: any): void => {
          console.error('Failed to load accounts', error);
          this.toast.error('Failed to load accounts');
        }
      });
  }

  loadCategories(): void {
    this.categoryApi.getCategoriesWithTransactions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories: Category[]): void => {
          this.categories.set(categories);
        },
        error: (error: any): void => {
          console.error('Failed to load categories', error);
          this.toast.error('Failed to load categories');
        }
      });
  }

  loadMerchants(): void {
    this.categoryApi.getMerchantsWithTransactions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (merchants: Merchant[]): void => this.merchants.set(merchants),
        error: (error: any): void => {
          console.error('Failed to load merchants', error);
          this.toast.error('Failed to load merchants');
        }
      });
  }

  loadTransactions(): void {
    this.loading.set(true);

    const filter: TransactionFilter = {};
    if (this.filterAccountId()) filter.accountId = this.filterAccountId()!;
    if (this.filterType()) filter.type = this.filterType()!;
    if (this.filterDescription()) filter.description = this.filterDescription();
    if (this.filterMerchant()) filter.merchant = this.filterMerchant();
    if (this.filterCategoryName()) filter.categoryName = this.filterCategoryName();
    if (this.filterMinAmount() !== null) filter.minAmount = this.filterMinAmount()!;
    if (this.filterMaxAmount() !== null) filter.maxAmount = this.filterMaxAmount()!;

    const dateRange: Date[] | null = this.filterDateRange();
    if (dateRange?.length === 2 && dateRange[0] && dateRange[1]) {
      filter.startDate = this.toISODate(dateRange[0]);
      filter.endDate = this.toISODate(dateRange[1]);
    }

    this.updateUrlParams();

    this.transactionApi.getTransactions(filter, {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.currentSort()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: PageResponse<Transaction>): void => {
          const accountMap = new Map(this.accounts().map((a: Account) => [a.id, a]));

          const enrichedTransactions = response.content.map((t: Transaction) => {
            return {
              ...t,
              accountName: accountMap.get(t.account.id) || undefined
            };
          });

          this.transactions.set(enrichedTransactions);
          this.totalRecords.set(response.totalElements);
          this.loading.set(false);
          this.selectedTransactions.set([]);
        },
        error: (error: any): void => {
          console.error('Failed to load transactions', error);
          this.toast.error('Failed to load transactions');
          this.loading.set(false);
        }
      });
  }

  onLazyLoad(event: any): void {
    const page: number = event.first ? Math.floor(event.first / event.rows) : 0;
    this.currentPage.set(page);
    this.pageSize.set(event.rows || 20);

    if (event.sortField) {
      const direction: 'asc' | 'desc' = event.sortOrder === 1 ? 'asc' : 'desc';
      this.currentSort.set(`${event.sortField},${direction}`);
    }

    this.loadTransactions();
  }

  onFilterChange(): void {
    this.currentPage.set(0);
    this.loadTransactions();
  }

  debouncedFilterChange = this.debounce((): void => {
    this.onFilterChange();
  }, 300);

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update((v: boolean): boolean => !v);
  }

  onCategorySearch(event: AutoCompleteCompleteEvent): void {
    const query: string = event.query.toLowerCase();
    const suggestions: string[] = this.categories().map((c: Category): string => c.name);
    this.filteredCategories.set(
      suggestions.filter(cat => cat.toLowerCase().includes(query))
    );
  }

  onVendorSearch(event: AutoCompleteCompleteEvent): void {
    const query: string = event.query.toLowerCase();
    this.filteredVendors.set(
      this.merchants().filter((v: Merchant): boolean => v.cleanName?.toLowerCase().includes(query))
    );
  }

  clearFilters(): void {
    this.filterAccountId.set(null);
    this.filterType.set(null);
    this.filterDateRange.set(null);
    this.filterDescription.set('');
    this.filterMerchant.set('');
    this.filterCategoryName.set('');
    this.filterMinAmount.set(null);
    this.filterMaxAmount.set(null);
    this.onFilterChange();
  }

  private debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>): void => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout((): void => func(...args), wait);
    };
  }

  openCreateDialog(): void {
    this.selectedTransaction.set(null);
    this.showDialog.set(true);
  }

  openEditDialog(transaction: Transaction): void {
    this.selectedTransaction.set(transaction);
    this.showDialog.set(true);
  }

  openImportDialog(): void {
    this.showImportDialog.set(true);
  }

  onImportComplete(): void {
    this.showImportDialog.set(false);
    this.openTransferDialog();
    this.loadTransactions();
  }

  openTransferDialog(): void {
    this.showTransferDialog.set(true);
  }

  onTransferMatchComplete(): void {
    this.loadTransactions();
  }

  prepareContextMenu(transaction: Transaction): void {
    this.selectedContextTransaction = transaction;
    this.contextMenuItems = [
      { label: 'Edit', icon: 'pi pi-pencil', command: () => this.openEditDialog(transaction) },
      { label: 'Delete', icon: 'pi pi-trash', styleClass: 'text-red-500', command: () => this.deleteTransaction(transaction) },
      { separator: true },
      { label: 'Mark as Transfer', icon: 'pi pi-arrow-right-arrow-left', command: () => this.markAsTransfer(transaction) },
      { separator: true },
      { label: 'Filter by Vendor', icon: 'pi pi-search', command: () => this.filterByVendor(transaction.merchant.cleanName) }
    ];
  }

  markAsTransfer(transaction: Transaction): void {
    this.confirmationService.confirm({
      header: 'Mark as Transfer?',
      message: 'This will remove this transaction from income/expense calculations.',
      accept: (): void => {
        this.transactionApi.markAsTransfer([transaction.id])
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Marked as transfer');
              this.loadTransactions();
            },
            error: (error: any): void => {
              console.error('Failed to mark as transfer', error);
              this.toast.error('Failed to update transaction');
            }
          });
      }
    });
  }

  filterByVendor(merchantName: string | null): void {
    if (merchantName) {
      this.filterMerchant.set(merchantName);
      this.showAdvancedFilters.set(true);
      this.onFilterChange();
    } else {
      this.toast.info('No vendor name to filter by');
    }
  }

  onSave(formData: TransactionFormData): void {
    const transaction = this.selectedTransaction();
    this.savingTransaction.set(true);

    const transactionDate = `${formData.date}T00:00:00Z`;

    if (transaction) {
      const resolvedMerchant = formData.merchant ?? transaction.merchant;
      const payload: TransactionUpdateRequest = {
        id: transaction.id,
        amount: formData.amount,
        transactionDate,
        description: formData.description ?? transaction.description ?? '',
        type: formData.type,
        categoryId: (formData.category ?? transaction.category)?.id ?? undefined,
        merchantId: resolvedMerchant?.id && resolvedMerchant.id > 0 ? resolvedMerchant.id : undefined
      };

      this.transactionApi.updateTransaction(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (): void => {
            this.toast.success('Transaction updated successfully');
            this.showDialog.set(false);
            this.savingTransaction.set(false);
            this.loadTransactions();
          },
          error: (error: any): void => {
            console.error('Failed to update transaction', error);
            this.toast.error(error.error?.detail || 'Failed to update transaction');
            this.savingTransaction.set(false);
          }
        });
    } else {
      const payload: TransactionCreateRequest = {
        accountId: formData.account,
        amount: formData.amount,
        transactionDate,
        description: formData.description ?? '',
        type: formData.type,
        categoryId: formData.category?.id ?? undefined,
        merchantId: formData.merchant?.id && formData.merchant.id > 0 ? formData.merchant.id : undefined
      };

      this.transactionApi.createTransaction(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (): void => {
            this.toast.success('Transaction created successfully');
            this.showDialog.set(false);
            this.savingTransaction.set(false);
            this.loadTransactions();
          },
          error: (error: any): void => {
            console.error('Failed to create transaction', error);
            this.toast.error(error.error?.detail || 'Failed to create transaction');
            this.savingTransaction.set(false);
          }
        });
    }
  }

  deleteTransaction(transaction: Transaction): void {
    this.confirmationService.confirm({
      header: 'Delete Transaction?',
      message: 'This will permanently delete the transaction. This action cannot be undone.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.transactionApi.deleteTransaction(transaction.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Transaction deleted successfully');
              this.loadTransactions();
            },
            error: (error: any): void => {
              console.error('Failed to delete transaction', error);
              this.toast.error(error.error?.detail || 'Failed to delete transaction');
            }
          });
      }
    });
  }

  bulkDelete(): void {
    const count: number = this.selectedTransactions().length;
    this.confirmationService.confirm({
      header: `Delete ${count} Transaction${count > 1 ? 's' : ''}?`,
      message: `This will permanently delete ${count} transaction${count > 1 ? 's' : ''}. This action cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        const ids: number[] = this.selectedTransactions().map((t: Transaction): number => t.id);
        this.transactionApi.bulkDeleteTransactions(ids)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success(`${count} transaction${count > 1 ? 's' : ''} deleted successfully`);
              this.loadTransactions();
            },
            error: (error: any): void => {
              console.error('Failed to delete transactions', error);
              this.toast.error('Failed to delete transactions');
            }
          });
      }
    });
  }

  openBulkEditDialog(): void {
    this.showBulkEditDialog.set(true);
  }

  onBulkSave(): void {
    this.savingBulkEdit.set(true);
    const updates: TransactionUpdateRequest[] = this.selectedTransactions().map((t: Transaction) => ({
      id: t.id,
      amount: t.amount,
      transactionDate: `${t.date}T00:00:00Z`,
      description: t.description ?? '',
      type: t.type,
      categoryId: t.category?.id ?? undefined,
      merchantId: t.merchant?.id ?? undefined
    }));
    this.transactionApi.bulkUpdateTransactions(updates)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count: number): void => {
          this.toast.success(`${count} transaction${count !== 1 ? 's' : ''} updated successfully`);
          this.showBulkEditDialog.set(false);
          this.savingBulkEdit.set(false);
          this.loadTransactions();
        },
        error: (error: any): void => {
          console.error('Failed to update transactions', error);
          this.toast.error(error.error?.detail || 'Failed to update transactions');
          this.savingBulkEdit.set(false);
        }
      });
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedTransactions.set([]);
    } else {
      this.selectedTransactions.set([...this.transactions()]);
    }
  }

  private toISODate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
