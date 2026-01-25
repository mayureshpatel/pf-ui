import { Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { Select } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { DatePicker } from 'primeng/datepicker';
import { AutoComplete, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ContextMenuModule } from 'primeng/contextmenu';
import {
  Transaction,
  TransactionFormData,
  TransactionFilter,
  TransactionType
} from '@models/transaction.model';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { RecurringTransaction, Frequency } from '@models/recurring.model';
import { TransactionApiService } from './services/transaction-api.service';
import { TransactionFormDialogComponent } from './components/transaction-form-dialog/transaction-form-dialog.component';
import { CsvImportDialogComponent } from './components/csv-import-dialog/csv-import-dialog.component';
import { BulkEditDialogComponent, BulkEditData } from './components/bulk-edit-dialog/bulk-edit-dialog.component';
import { TransferMatchingDialogComponent } from './components/transfer-matching-dialog/transfer-matching-dialog.component';
import { VendorRuleFormDialogComponent } from '@shared/components/vendor-rule-form-dialog/vendor-rule-form-dialog.component';
import { RecurringFormDialogComponent } from '@shared/components/recurring-form-dialog/recurring-form-dialog.component';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import {
  formatTransactionAmount,
  getTransactionTypeInfo,
  getAmountClass,
  formatDate
} from '@shared/utils/transaction.utils';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TableModule,
    CardModule,
    ConfirmDialogModule,
    TooltipModule,
    Select,
    CheckboxModule,
    TagModule,
    DatePicker,
    AutoComplete,
    InputNumberModule,
    InputTextModule,
    ContextMenuModule,
    TransactionFormDialogComponent,
    CsvImportDialogComponent,
    BulkEditDialogComponent,
    TransferMatchingDialogComponent,
    VendorRuleFormDialogComponent,
    RecurringFormDialogComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './transactions.component.html'
})
export class TransactionsComponent implements OnInit {
  private readonly transactionApi = inject(TransactionApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly categoryApi = inject(CategoryApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);

  // State
  transactions: WritableSignal<Transaction[]> = signal([]);
  accounts: WritableSignal<Account[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  showImportDialog: WritableSignal<boolean> = signal(false);
  showBulkEditDialog: WritableSignal<boolean> = signal(false);
  showTransferDialog: WritableSignal<boolean> = signal(false);
  showVendorRuleDialog: WritableSignal<boolean> = signal(false);
  showRecurringDialog: WritableSignal<boolean> = signal(false);
  
  selectedTransaction: WritableSignal<Transaction | null> = signal(null);
  selectedTransactions: WritableSignal<Transaction[]> = signal([]);
  
  // Context Menu State
  contextMenuItems: MenuItem[] = [];
  selectedContextTransaction: Transaction | null = null;
  selectedTransactionKeyword: WritableSignal<string> = signal('');

  savingTransaction: WritableSignal<boolean> = signal(false);
  savingBulkEdit: WritableSignal<boolean> = signal(false);

  // Pagination
  currentPage: WritableSignal<number> = signal(0);
  pageSize: WritableSignal<number> = signal(20);
  totalRecords: WritableSignal<number> = signal(0);

  // Quick Filters
  filterAccountId: WritableSignal<number | null> = signal(null);
  filterType: WritableSignal<TransactionType | null> = signal(null);
  filterDateRange: WritableSignal<Date[] | null> = signal(null);

  // Advanced Filters
  showAdvancedFilters: WritableSignal<boolean> = signal(false);
  filterDescription: WritableSignal<string> = signal('');
  filterVendorName: WritableSignal<string> = signal('');
  filterCategoryName: WritableSignal<string> = signal('');
  filterMinAmount: WritableSignal<number | null> = signal(null);
  filterMaxAmount: WritableSignal<number | null> = signal(null);

  // Sorting
  currentSort: WritableSignal<string> = signal('date,desc');

  // Autocomplete data
  categories: WritableSignal<Category[]> = signal([]);
  filteredCategories: WritableSignal<string[]> = signal([]);
  vendorSuggestions: WritableSignal<string[]> = signal([]);
  filteredVendors: WritableSignal<string[]> = signal([]);

  // Computed
  isEmpty = computed(() => this.transactions().length === 0 && !this.loading());
  hasSelection = computed(() => this.selectedTransactions().length > 0);
  allSelected = computed(() =>
    this.selectedTransactions().length === this.transactions().length &&
    this.transactions().length > 0
  );

  activeFilterCount = computed(() => {
    let count = 0;
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

  hasAdvancedFilters = computed(() =>
    !!this.filterDescription() ||
    !!this.filterVendorName() ||
    !!this.filterCategoryName() ||
    this.filterMinAmount() !== null ||
    this.filterMaxAmount() !== null
  );

  // Utility functions
  formatTransactionAmount = formatTransactionAmount;
  getTransactionTypeInfo = getTransactionTypeInfo;
  getAmountClass = getAmountClass;
  formatDate = formatDate;

  // Dropdown options
  transactionTypes = [
    { label: 'All Types', value: null },
    { label: 'Income', value: TransactionType.INCOME },
    { label: 'Expense', value: TransactionType.EXPENSE },
    { label: 'Transfer', value: TransactionType.TRANSFER }
  ];

  accountOptions = computed(() => {
    const accounts = this.accounts();
    return [
      { label: 'All Accounts', value: null },
      ...accounts.map(a => ({ label: a.name, value: a.id }))
    ];
  });

  ngOnInit(): void {
    this.loadFilterState(); // Load saved filters first

    // Check for query params (e.g. from categories page)
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.filterCategoryName.set(params['category']);
        this.showAdvancedFilters.set(true);
        // We don't need to call saveFilterState here strictly, 
        // as loadTransactions will do it, but calling it ensures 
        // the state is consistent immediately.
        this.saveFilterState();
      }
    });

    this.loadCategories();
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.accountApi.getAccounts().subscribe({
      next: (accounts) => {
        this.accounts.set(accounts);
        // Load transactions after accounts are loaded (needed for account name enrichment)
        this.loadTransactions();
      },
      error: () => {
        this.toast.error('Failed to load accounts');
      }
    });
  }

  loadCategories(): void {
    this.categoryApi.getCategories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => {} // Categories are optional for filtering
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

    const dateRange = this.filterDateRange();
    if (dateRange && dateRange.length === 2 && dateRange[0] && dateRange[1]) {
      filter.startDate = this.toISODate(dateRange[0]);
      filter.endDate = this.toISODate(dateRange[1]);
    }

    // Save filter state to localStorage
    this.saveFilterState();

    this.transactionApi.getTransactions(filter, {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: this.currentSort()
    }).subscribe({
      next: (response) => {
        // Enrich transactions with account names
        const accountMap = new Map(this.accounts().map(a => [a.id, a.name]));
        const enrichedTransactions = response.content.map(t => ({
          ...t,
          accountName: accountMap.get(t.accountId) || 'Unknown Account'
        }));

        this.transactions.set(enrichedTransactions);
        this.totalRecords.set(response.totalElements);
        this.loading.set(false);
        this.selectedTransactions.set([]);

        // Update vendor suggestions for autocomplete
        this.updateVendorSuggestions(enrichedTransactions);
      },
      error: () => {
        this.toast.error('Failed to load transactions');
        this.loading.set(false);
      }
    });
  }

  onLazyLoad(event: any): void {
    // PrimeNG lazy table sends event with 'first' and 'rows'
    // 'first' is the index of the first record (0-based), not the page number
    const page = event.first ? Math.floor(event.first / event.rows) : 0;
    this.currentPage.set(page);
    this.pageSize.set(event.rows || 20);

    // Handle sorting
    if (event.sortField) {
      const direction = event.sortOrder === 1 ? 'asc' : 'desc';
      this.currentSort.set(`${event.sortField},${direction}`);
    }

    this.loadTransactions();
  }

  onFilterChange(): void {
    this.currentPage.set(0);
    this.loadTransactions();
  }

  debouncedFilterChange = this.debounce(() => {
    this.onFilterChange();
  }, 300);

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update(v => !v);
  }

  onCategorySearch(event: AutoCompleteCompleteEvent): void {
    const query = event.query.toLowerCase();
    const suggestions = this.categories().map(c => c.name);
    this.filteredCategories.set(
      suggestions.filter(cat => cat.toLowerCase().includes(query))
    );
  }

  onVendorSearch(event: AutoCompleteCompleteEvent): void {
    const query = event.query.toLowerCase();
    const uniqueVendors = [...new Set([
      ...this.transactions().map(t => t.vendorName).filter(Boolean) as string[],
      ...this.vendorSuggestions()
    ])];
    this.filteredVendors.set(
      uniqueVendors.filter(v => v.toLowerCase().includes(query))
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
    const vendors = transactions
      .map(t => t.vendorName)
      .filter(Boolean) as string[];
    const unique = [...new Set([...this.vendorSuggestions(), ...vendors])];
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
    const saved = localStorage.getItem('pf_transaction_filters');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.accountId) this.filterAccountId.set(state.accountId);
        if (state.type) this.filterType.set(state.type);
        if (state.dateRange) this.filterDateRange.set(state.dateRange.map((d: string) => new Date(d)));
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
        // Ignore parse errors
      }
    }
  }

  private debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
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
    this.openTransferDialog(); // Check for transfers after import
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
      { separator: true },
      {
        label: 'Mark as Transfer',
        icon: 'pi pi-arrow-right-arrow-left',
        command: () => this.markAsTransfer(transaction)
      },
      {
        label: 'Create Vendor Rule',
        icon: 'pi pi-filter',
        command: () => this.openVendorRuleDialog(transaction)
      },
      {
        label: 'Create Recurring',
        icon: 'pi pi-refresh',
        command: () => this.openRecurringDialog(transaction)
      },
      { separator: true },
      {
        label: 'Filter by Vendor',
        icon: 'pi pi-search',
        command: () => this.filterByVendor(transaction.vendorName)
      }
    ];
  }

  markAsTransfer(transaction: Transaction): void {
    this.confirmationService.confirm({
      header: 'Mark as Transfer?',
      message: 'This will remove this transaction from income/expense calculations.',
      accept: () => {
        this.transactionApi.markAsTransfer([transaction.id]).subscribe({
          next: () => {
            this.toast.success('Marked as transfer');
            this.loadTransactions();
          },
          error: () => this.toast.error('Failed to update transaction')
        });
      }
    });
  }

  openVendorRuleDialog(transaction: Transaction): void {
    this.selectedContextTransaction = transaction;
    // Use originalVendorName if available, otherwise description
    // This is usually what we want to clean up
    const keyword = transaction.originalVendorName || transaction.description || '';
    this.selectedTransactionKeyword.set(keyword);
    this.showVendorRuleDialog.set(true);
  }

  onVendorRuleSaved(): void {
    this.showVendorRuleDialog.set(false);
    this.loadTransactions(); // Reload to see if rule applied? (It won't apply to existing unless we re-run cleaning, but good practice)
  }

  // We need to map Transaction to RecurringTransaction shape for the dialog
  // Since the dialog expects a full RecurringTransaction object for editing,
  // we will pass a 'fake' one with ID 0 to indicate it's new but has data.
  // We need to handle this in the dialog component or here.
  // Actually, let's just update the dialog component to handle 'prefill' better.
  // For now, let's map it to a partial object and see if we can adapt the dialog later.
  // The dialog uses `transaction()` input.
  
  recurringPrefill: WritableSignal<RecurringTransaction | null> = signal(null);

  openRecurringDialog(transaction: Transaction): void {
    this.recurringPrefill.set({
      id: 0, // Indicates new
      merchantName: transaction.vendorName || transaction.originalVendorName || '',
      amount: Math.abs(transaction.amount),
      frequency: Frequency.MONTHLY, // Default
      nextDate: transaction.date, // Use transaction date as start
      active: true,
      accountId: transaction.accountId,
      accountName: transaction.accountName
    });
    this.showRecurringDialog.set(true);
  }

  onRecurringSaved(): void {
    this.showRecurringDialog.set(false);
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

  onSave(formData: TransactionFormData): void {
    const transaction = this.selectedTransaction();
    this.savingTransaction.set(true);

    if (transaction) {
      // Update existing transaction
      this.transactionApi.updateTransaction(transaction.id, formData).subscribe({
        next: () => {
          this.toast.success('Transaction updated successfully');
          this.showDialog.set(false);
          this.savingTransaction.set(false);
          this.loadTransactions();
        },
        error: (error) => {
          this.toast.error(error.error?.detail || 'Failed to update transaction');
          this.savingTransaction.set(false);
        }
      });
    } else {
      // Create new transaction
      this.transactionApi.createTransaction(formData).subscribe({
        next: () => {
          this.toast.success('Transaction created successfully');
          this.showDialog.set(false);
          this.savingTransaction.set(false);
          this.loadTransactions();
        },
        error: (error) => {
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
        this.transactionApi.deleteTransaction(transaction.id).subscribe({
          next: () => {
            this.toast.success('Transaction deleted successfully');
            this.loadTransactions();
          },
          error: (error) => {
            const message = error.error?.detail || 'Failed to delete transaction';
            this.toast.error(message);
          }
        });
      }
    });
  }

  bulkDelete(): void {
    const count = this.selectedTransactions().length;
    this.confirmationService.confirm({
      header: `Delete ${count} Transaction${count > 1 ? 's' : ''}?`,
      message: `This will permanently delete ${count} transaction${count > 1 ? 's' : ''}. This action cannot be undone.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const ids = this.selectedTransactions().map(t => t.id);
        this.transactionApi.bulkDeleteTransactions(ids).subscribe({
          next: () => {
            this.toast.success(`${count} transaction${count > 1 ? 's' : ''} deleted successfully`);
            this.loadTransactions();
          },
          error: () => {
            this.toast.error('Failed to delete transactions');
          }
        });
      }
    });
  }

  openBulkEditDialog(): void {
    this.showBulkEditDialog.set(true);
  }

  onBulkSave(data: BulkEditData): void {
    this.savingBulkEdit.set(true);

    // Build update DTOs by merging selected transactions with bulk edit data
    const updates: TransactionFormData[] = this.selectedTransactions().map(txn => ({
      id: txn.id,
      date: txn.date,
      type: txn.type,
      accountId: txn.accountId,
      amount: txn.amount,
      description: data.updateDescription ? data.description! : (txn.description || undefined),
      vendorName: data.updateVendor ? data.vendorName : (txn.vendorName || undefined),
      categoryName: data.updateCategory ? data.categoryName : (txn.categoryName || undefined)
    }));

    this.transactionApi.bulkUpdateTransactions(updates).subscribe({
      next: (updated) => {
        this.toast.success(`${updated.length} transaction${updated.length > 1 ? 's' : ''} updated successfully`);
        this.showBulkEditDialog.set(false);
        this.savingBulkEdit.set(false);
        this.loadTransactions();
      },
      error: (error) => {
        this.toast.error(error.error?.detail || 'Failed to update transactions');
        this.savingBulkEdit.set(false);
      }
    });
  }

  getCategoryDisplay(categoryName: string | null): string {
    return categoryName || 'Uncategorized';
  }

  getCategorySeverity(categoryName: string | null): 'secondary' | 'contrast' {
    return categoryName ? 'secondary' : 'contrast';
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