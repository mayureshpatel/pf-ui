import { Component, computed, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { ConfirmationService } from 'primeng/api';
import {
  Transaction,
  TransactionFormData,
  TransactionFilter,
  TransactionType
} from '@models/transaction.model';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { TransactionApiService } from './services/transaction-api.service';
import { TransactionFormDialogComponent } from './components/transaction-form-dialog/transaction-form-dialog.component';
import { CsvImportDialogComponent } from './components/csv-import-dialog/csv-import-dialog.component';
import { BulkEditDialogComponent, BulkEditData } from './components/bulk-edit-dialog/bulk-edit-dialog.component';
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
    TransactionFormDialogComponent,
    CsvImportDialogComponent,
    BulkEditDialogComponent
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

  // State
  transactions: WritableSignal<Transaction[]> = signal([]);
  accounts: WritableSignal<Account[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  showDialog: WritableSignal<boolean> = signal(false);
  showImportDialog: WritableSignal<boolean> = signal(false);
  showBulkEditDialog: WritableSignal<boolean> = signal(false);
  selectedTransaction: WritableSignal<Transaction | null> = signal(null);
  selectedTransactions: WritableSignal<Transaction[]> = signal([]);
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

  onPageChange(event: any): void {
    // PrimeNG lazy table sends event with 'first' and 'rows'
    // 'first' is the index of the first record (0-based), not the page number
    const page = event.first ? Math.floor(event.first / event.rows) : 0;
    this.currentPage.set(page);
    this.pageSize.set(event.rows || 20);
    this.loadTransactions();
  }

  onFilterChange(): void {
    this.currentPage.set(0);
    this.loadTransactions();
  }

  clearFilters(): void {
    this.filterAccountId.set(null);
    this.filterType.set(null);
    this.filterDateRange.set(null);
    this.onFilterChange();
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
    this.loadTransactions();
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
