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
import {ActivatedRoute, Params} from '@angular/router';
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
import {PageResponse, Transaction, TransactionFilter, TransactionType} from '@models/transaction.model';
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
import {
  formatDate,
  formatTransactionAmount,
  getAmountClass,
  getTransactionTypeInfo
} from '@shared/utils/transaction.utils';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {TableToolbarComponent} from '@shared/components/table-toolbar/table-toolbar';

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
    TransferMatchingDialogComponent
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
  filterVendorName: WritableSignal<string> = signal('');
  filterCategoryName: WritableSignal<string> = signal('');
  filterMinAmount: WritableSignal<number | null> = signal(null);
  filterMaxAmount: WritableSignal<number | null> = signal(null);

  // sorting
  currentSort: WritableSignal<string> = signal('date,desc');

  // autocomplete data
  categories: WritableSignal<Category[]> = signal([]);
  filteredCategories: WritableSignal<string[]> = signal([]);
  vendorSuggestions: WritableSignal<string[]> = signal([]);
  filteredVendors: WritableSignal<string[]> = signal([]);

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
    if (this.filterVendorName()) count++;
    if (this.filterCategoryName()) count++;
    if (this.filterMinAmount() !== null) count++;
    if (this.filterMaxAmount() !== null) count++;
    return count;
  });

  hasAdvancedFilters: Signal<boolean> = computed((): boolean =>
    !!this.filterDescription() ||
    !!this.filterVendorName() ||
    !!this.filterCategoryName() ||
    this.filterMinAmount() !== null ||
    this.filterMaxAmount() !== null
  );

  // utility functions
  formatTransactionAmount = formatTransactionAmount;
  getTransactionTypeInfo = getTransactionTypeInfo;
  getAmountClass = getAmountClass;
  formatDate = formatDate;

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
    this.loadFilterState();

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => {
        if (params['category']) {
          this.filterCategoryName.set(params['category']);
          this.showAdvancedFilters.set(true);
          this.saveFilterState();
        }
      });

    this.loadCategories();
    this.loadAccounts();
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    // Explicitly clear all signals holding large data to allow garbage collection
    this.transactions.set([]);
    this.selectedTransactions.set([]);
    this.categories.set([]);
    this.accounts.set([]);
    this.vendorSuggestions.set([]);
    this.filteredCategories.set([]);
    this.filteredVendors.set([]);
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
    this.categoryApi.getChildCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories: Category[]): void => this.categories.set(categories),
        error: (error: any): void => {
          console.error('Failed to load categories', error);
          this.toast.error('Failed to load categories');
        }
      });
  }

  loadTransactions(): void {
    this.loading.set(true);

    const filter: TransactionFilter = {};
    if (this.filterAccountId()) filter.accountId = this.filterAccountId()!;
    if (this.filterType()) filter.type = this.filterType()!;
    if (this.filterDescription()) filter.description = this.filterDescription();
    if (this.filterVendorName()) filter.vendorName = this.filterVendorName();
    if (this.filterCategoryName()) filter.categoryName = this.filterCategoryName();
    if (this.filterMinAmount() !== null) filter.minAmount = this.filterMinAmount()!;
    if (this.filterMaxAmount() !== null) filter.maxAmount = this.filterMaxAmount()!;

    const dateRange: Date[] | null = this.filterDateRange();
    if (dateRange?.length === 2 && dateRange[0] && dateRange[1]) {
      filter.startDate = this.toISODate(dateRange[0]);
      filter.endDate = this.toISODate(dateRange[1]);
    }

    // Save filter state to localStorage
    this.saveFilterState();

    this.transactionApi.getTransactions(filter, {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.currentSort()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: PageResponse<Transaction>): void => {
          // Enrich transactions with account and category info
          const accountMap = new Map(this.accounts().map((a: Account) => [a.id, a]));
          const categoryMap = new Map(this.categories().map((c: Category) => [c.id, c]));

          const enrichedTransactions = response.content.map((t: Transaction) => {
            const category: Category | undefined = t.category ? categoryMap.get(t.category.id) : undefined;

            return {
              ...t,
              accountName: accountMap.get(t.account.id) || undefined,
              iconography: category?.iconography
            };
          });

          this.transactions.set(enrichedTransactions);
          this.totalRecords.set(response.totalElements);
          this.loading.set(false);
          this.selectedTransactions.set([]);

          // Update vendor suggestions for autocomplete
          this.updateVendorSuggestions(enrichedTransactions);
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

    // Handle sorting
    if (event.sortField) {
      const direction: "asc" | "desc" = event.sortOrder === 1 ? 'asc' : 'desc';
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
    const uniqueVendors: string[] = [...new Set([
      ...this.transactions().map(t => t.merchant.cleanName).filter(Boolean),
      ...this.vendorSuggestions()
    ])];
    this.filteredVendors.set(
      uniqueVendors.filter((v: string): boolean => v.toLowerCase().includes(query))
    );
  }

  clearFilters(): void {
    this.filterAccountId.set(null);
    this.filterType.set(null);
    this.filterDateRange.set(null);
    this.filterDescription.set('');
    this.filterVendorName.set('');
    this.filterCategoryName.set('');
    this.filterMinAmount.set(null);
    this.filterMaxAmount.set(null);
    localStorage.removeItem('pf_transaction_filters');
    this.onFilterChange();
  }

  private updateVendorSuggestions(transactions: Transaction[]): void {
    // Only use current page vendors - don't accumulate across loads to prevent memory leak
    const vendors: string[] = transactions
      .map((t: Transaction): string => t.merchant.cleanName)
      .filter(Boolean);
    const unique: string[] = [...new Set(vendors)];
    this.vendorSuggestions.set(unique);
  }

  private saveFilterState(): void {
    const filterState = {
      accountId: this.filterAccountId(),
      type: this.filterType(),
      dateRange: this.filterDateRange(),
      description: this.filterDescription(),
      vendorName: this.filterVendorName(),
      categoryName: this.filterCategoryName(),
      minAmount: this.filterMinAmount(),
      maxAmount: this.filterMaxAmount(),
      sort: this.currentSort()
    };
    localStorage.setItem('pf_transaction_filters', JSON.stringify(filterState));
  }

  private loadFilterState(): void {
    const saved: string | null = localStorage.getItem('pf_transaction_filters');

    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.accountId) this.filterAccountId.set(state.accountId);
        if (state.type) this.filterType.set(state.type);
        if (state.dateRange) this.filterDateRange.set(state.dateRange.map((d: string): Date => new Date(d)));
        if (state.description) this.filterDescription.set(state.description);
        if (state.vendorName) this.filterVendorName.set(state.vendorName);
        if (state.categoryName) this.filterCategoryName.set(state.categoryName);
        if (state.minAmount !== null) this.filterMinAmount.set(state.minAmount);
        if (state.maxAmount !== null) this.filterMaxAmount.set(state.maxAmount);
        if (state.sort) this.currentSort.set(state.sort);

        // Auto-expand advanced filters if any are active
        if (this.hasAdvancedFilters()) {
          this.showAdvancedFilters.set(true);
        }
      } catch (e) {
        console.error('Error parsing transaction filter state', e);
      }
    }
  }

  private debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
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

  // Context Menu Actions
  prepareContextMenu(transaction: Transaction): void {
    this.selectedContextTransaction = transaction;
    this.contextMenuItems = [
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => this.openEditDialog(transaction)
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        styleClass: 'text-red-500',
        command: () => this.deleteTransaction(transaction)
      },
      {separator: true},
      {
        label: 'Mark as Transfer',
        icon: 'pi pi-arrow-right-arrow-left',
        command: () => this.markAsTransfer(transaction)
      },
      {separator: true},
      {
        label: 'Filter by Vendor',
        icon: 'pi pi-search',
        command: () => this.filterByVendor(transaction.merchant.cleanName)
      }
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
              this.toast.error('Failed to update transaction')
            }
          });
      }
    });
  }

  filterByVendor(vendorName: string | null): void {
    if (vendorName) {
      this.filterVendorName.set(vendorName);
      this.showAdvancedFilters.set(true);
      this.onFilterChange();
    } else {
      this.toast.info('No vendor name to filter by');
    }
  }

  onSave(formData: Transaction): void {
    const transaction = this.selectedTransaction();
    this.savingTransaction.set(true);

    if (transaction) {
      // Update existing transaction
      this.transactionApi.updateTransaction(transaction.id, formData)
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
      // Create new transaction
      this.transactionApi.createTransaction(formData)
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

              const message = error.error?.detail || 'Failed to delete transaction';
              this.toast.error(message);
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

    // Build update DTOs by merging selected transactions with bulk edit data
    const updates: Transaction[] = this.selectedTransactions();

    this.transactionApi.bulkUpdateTransactions(updates)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated: Transaction[]): void => {
          this.toast.success(`${updated.length} transaction${updated.length > 1 ? 's' : ''} updated successfully`);
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
