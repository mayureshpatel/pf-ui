import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  untracked,
  WritableSignal
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {finalize, Observable, skip} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {TooltipModule} from 'primeng/tooltip';
import {CheckboxModule} from 'primeng/checkbox';
import {TagModule} from 'primeng/tag';
import {InputNumberModule} from 'primeng/inputnumber';
import {InputTextModule} from 'primeng/inputtext';
import {ConfirmationService, FilterMetadata} from 'primeng/api';
import {ContextMenuModule} from 'primeng/contextmenu';
import {DatePicker} from 'primeng/datepicker';
import {SelectModule} from 'primeng/select';

import {
  PageResponse,
  Transaction,
  TransactionCreateRequest,
  TransactionFilter,
  TransactionState,
  TransactionType,
  TransactionUpdateRequest
} from '@models/transaction.model';
import {Account} from '@models/account.model';
import {Category} from '@models/category.model';
import {Merchant} from '@models/merchant.model';
import {TransactionApiService} from './services/transaction-api.service';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {FormatTransactionTypeAmountPipe} from '@shared/pipes/format-transaction-type-amount.pipe';
import {TransactionFormDrawerComponent} from './components/transaction-form-drawer/transaction-form-drawer.component';
import {CsvImportDialogComponent} from './components/csv-import-dialog/csv-import-dialog.component';
import {
  TransferMatchingDialogComponent
} from './components/transfer-matching-dialog/transfer-matching-dialog.component';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

/**
 * Component for managing and auditing the master transaction ledger.
 *
 * Provides high-fidelity filtering, bulk operations, CSV imports, and
 * intelligent transfer matching.
 */
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
    CheckboxModule,
    TagModule,
    InputNumberModule,
    InputTextModule,
    ContextMenuModule,
    DatePicker,
    SelectModule,
    ScreenToolbarComponent,
    TransactionFormDrawerComponent,
    CsvImportDialogComponent,
    TransferMatchingDialogComponent,
    FormatTransactionTypeAmountPipe
  ],
  providers: [FormatCurrencyPipe, FormatTransactionTypeAmountPipe],
  templateUrl: './transactions.component.html'
})
export class TransactionsComponent implements OnInit, OnDestroy {
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The master state object for the transaction view. */
  readonly state: WritableSignal<TransactionState> = signal({
    filter: {},
    page: 0,
    size: 20,
    sort: 'date,desc'
  });

  /** The dataset of transactions currently loaded in the view. */
  readonly transactions: WritableSignal<Transaction[]> = signal([]);

  /** Available bank/financial accounts. */
  readonly accounts: WritableSignal<Account[]> = signal([]);

  /** All known categories for autocomplete and assignment. */
  readonly categories: WritableSignal<Category[]> = signal([]);

  /** All known merchants for autocomplete and assignment. */
  readonly merchants: WritableSignal<Merchant[]> = signal([]);

  /** Global loading state for ledger refresh. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Indicates if a single transaction is currently being saved. */
  readonly savingTransaction: WritableSignal<boolean> = signal(false);

  /** Indicates if the transaction form drawer is currently open. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the import dialog is currently open. */
  readonly showImportDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the bulk edit dialog is currently open. */
  readonly showBulkEditDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the transfer matching dialog is currently open. */
  readonly showTransferDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the advanced filters dialog is currently open. */
  readonly showAdvancedFilters: WritableSignal<boolean> = signal(false);

  /** User selection state for bulk actions. */
  readonly selectedTransactions: WritableSignal<Transaction[]> = signal([]);

  /** The transaction currently target for editing. */
  readonly selectedTransaction: WritableSignal<Transaction | null> = signal(null);

  /** The total number of records matching the current filter (for pagination). */
  readonly totalRecords: WritableSignal<number> = signal(0);

  /** Unique merchant names for filtering. */
  readonly uniqueMerchantNames: Signal<string[]> = computed((): string[] => {
    const names: string[] = this.merchants()
      .map((m: Merchant): string => m.cleanName)
      .filter((name: string): name is string => !!name);
    return [...new Set(names)].sort(((a: string, b: string): number => a.localeCompare(b)));
  });

  /** Grouped categories for filtering, only including sub-categories. */
  readonly groupedCategories: Signal<any[]> = computed((): any[] => {
    const categories: Category[] = this.categories();
    const subCategories: Category[] = categories.filter((c: Category): boolean => !!c.parent);

    const groups: Map<number, any> = new Map();

    subCategories.forEach((cat: Category): void => {
      const parentId: number = cat.parent!.id;
      if (!groups.has(parentId)) {
        groups.set(parentId, {
          label: cat.parent!.name,
          value: parentId,
          items: []
        });
      }
      groups.get(parentId).items.push({
        label: cat.name,
        value: cat.name
      });
    });

    const result = Array.from(groups.values()).sort(((a: any, b: any): number => a.label.localeCompare(b.label)));
    result.unshift({
      label: 'Special',
      value: -1,
      items: [{ label: 'Uncategorized', value: '__UNDEFINED__' }]
    });

    return result;
    });

    /** Maps internal transaction state to PrimeNG filter metadata for UI synchronization. */
    readonly tableFilters: Signal<{ [key: string]: FilterMetadata | FilterMetadata[] }> = computed(() => {
    const filter: TransactionFilter = this.state().filter;
    const filters: { [key: string]: FilterMetadata | FilterMetadata[] } = {
      date: [{value: null, matchMode: 'dateIs', operator: 'and'}],
      merchantAndDesc: [{value: null, matchMode: 'custom', operator: 'and'}],
      categoryName: [{value: filter.categoryName || null, matchMode: 'equals', operator: 'and'}],
      accountId: [{value: filter.accountId || null, matchMode: 'equals', operator: 'and'}]
    };

    if (filter.startDate || filter.endDate) {
      const dateFilters: FilterMetadata[] = [];
      if (filter.startDate && filter.endDate && filter.startDate.getTime() === filter.endDate.getTime()) {
        dateFilters.push({value: filter.startDate, matchMode: 'dateIs', operator: 'and'});
      } else {
        if (filter.startDate) {
          dateFilters.push({value: filter.startDate, matchMode: 'dateAfter', operator: 'and'});
        }
        if (filter.endDate) {
          dateFilters.push({value: filter.endDate, matchMode: 'dateBefore', operator: 'and'});
        }
      }
      filters['date'] = dateFilters;
    }

    if (filter.merchant || filter.description) {
      filters['merchantAndDesc'] = [{
        value: {merchant: filter.merchant || null, description: filter.description || null},
        matchMode: 'custom',
        operator: 'and'
      }];
    }

    return filters;
  });

  /** Indicates if the current dataset is empty. */
  readonly isEmpty: Signal<boolean> = computed((): boolean => this.transactions().length === 0 && !this.loading());

  /** Indicates if all visible transactions are currently selected. */
  readonly allSelected: Signal<boolean> = computed((): boolean =>
    this.selectedTransactions().length > 0 && this.selectedTransactions().length === this.transactions().length
  );

  /** Calculates the number of active filters for UI badges. */
  readonly activeFilterCount: Signal<number> = computed((): number => {
    const filter: TransactionFilter = this.state().filter;
    let count: number = 0;
    if (filter.accountId) count++;
    if (filter.type) count++;
    if (filter.startDate) count++;
    if (filter.description) count++;
    if (filter.merchant) count++;
    if (filter.categoryName) count++;
    if (filter.minAmount !== undefined) count++;
    if (filter.maxAmount !== undefined) count++;
    return count;
  });

  constructor() {
    /**
     * Core effect that reactively synchronizes the view state with the backend.
     * Automatically triggers a data load whenever filters, pagination, or sorting changes.
     */
    effect((): void => {
      const state: TransactionState = this.state();
      this.updateUrlParams(state);

      untracked((): void => {
        this.loadTransactions();
      });
    });
  }

  /**
   * Initializes component data and filters from URL on load.
   */
  ngOnInit(): void {
    this.hydrateFromParams(this.route.snapshot.queryParams);
    this.loadAccounts();
    this.loadCategories();
    this.loadMerchants();

    // Listen for external URL changes (e.g. browser back button)
    this.route.queryParams
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.hydrateFromParams(params));
  }

  ngOnDestroy(): void {
    this.transactions.set([]);
    this.selectedTransactions.set([]);
  }

  /**
   * Fetches the transaction dataset from the API based on current state.
   */
  private loadTransactions(): void {
    this.loading.set(true);
    const {filter, page, size, sort} = this.state();

    this.transactionApi.getTransactions(filter, {page, size, sort})
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (res: PageResponse<Transaction>): void => {
          this.transactions.set(res.content);
          this.totalRecords.set(res.page.totalElements);
          this.selectedTransactions.set([]);
        },
        error: (err: any): void => {
          console.error('Failed to load transactions:', err);
          this.toast.error('Failed to refresh ledger.');
        }
      });
  }

  /**
   * Translates URL query parameters into internal signal state.
   * @param params - The query parameters from the active route.
   */
  private hydrateFromParams(params: Params): void {
    const filter: TransactionFilter = {
      accountId: params['accountId'] ? Number(params['accountId']) : undefined,
      type: params['type'] as TransactionType || undefined,
      description: params['description'] || undefined,
      merchant: params['merchant'] || undefined,
      categoryName: params['categoryName'] || undefined,
      minAmount: params['minAmount'] !== undefined ? Number(params['minAmount']) : undefined,
      maxAmount: params['maxAmount'] !== undefined ? Number(params['maxAmount']) : undefined,
      startDate: params['startDate'] ? new Date(params['startDate']) : undefined,
      endDate: params['endDate'] ? new Date(params['endDate']) : undefined
    };

    const page: number = params['page'] ? Number(params['page']) : 0;
    const size: number = params['size'] ? Number(params['size']) : 20;
    const sort: string = params['sort'] || 'date,desc';

    const currentState: TransactionState = this.state();
    if (JSON.stringify(filter) !== JSON.stringify(currentState.filter) ||
      page !== currentState.page ||
      size !== currentState.size ||
      sort !== currentState.sort) {

      this.state.set({filter, page, size, sort});
    }

    if (this.activeFilterCount() > 0) {
      this.showAdvancedFilters.set(true);
    }
  }

  /**
   * Serializes the current signal state to URL query parameters.
   * @param state - The current transaction state.
   */
  private updateUrlParams(state: TransactionState): void {
    const queryParams: Params = {};
    const {filter, page, size, sort} = state;

    if (filter.accountId) queryParams['accountId'] = filter.accountId;
    if (filter.type) queryParams['type'] = filter.type;
    if (filter.description) queryParams['description'] = filter.description;
    if (filter.merchant) queryParams['merchant'] = filter.merchant;
    if (filter.categoryName) queryParams['categoryName'] = filter.categoryName;
    if (filter.minAmount !== undefined) queryParams['minAmount'] = filter.minAmount;
    if (filter.maxAmount !== undefined) queryParams['maxAmount'] = filter.maxAmount;
    if (filter.startDate) queryParams['startDate'] = filter.startDate;
    if (filter.endDate) queryParams['endDate'] = filter.endDate;

    if (page > 0) queryParams['page'] = page;
    if (size !== 20) queryParams['size'] = size;
    if (sort !== 'date,desc') queryParams['sort'] = sort;

    this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'replace',
      replaceUrl: true
    });
  }

  private loadAccounts(): void {
    this.accountApi.getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Account[]): void => this.accounts.set(data));
  }

  private loadCategories(): void {
    this.categoryApi.getCategoriesWithTransactions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Category[]): void => this.categories.set(data));
  }

  private loadMerchants(): void {
    this.categoryApi.getMerchantsWithTransactions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Merchant[]): void => this.merchants.set(data));
  }

  onLazyLoad(event: any): void {
    const rows: number = event.rows ?? 20;
    const first: number = event.first ?? 0;
    const page: number = Math.floor(first / rows);
    let sort: string = this.state().sort;

    if (event.sortField) {
      const dir: string = event.sortOrder === 1 ? 'asc' : 'desc';
      sort = `${event.sortField},${dir}`;
    }

    // Extract filters from PrimeNG event
    const filter: TransactionFilter = {...this.state().filter};
    if (event.filters) {
      const dateFilter = event.filters['date'];
      if (dateFilter) {
        const metadatas = Array.isArray(dateFilter) ? dateFilter : [dateFilter];
        filter.startDate = undefined;
        filter.endDate = undefined;

        metadatas.forEach((m: FilterMetadata): void => {
          if (m.value) {
            const dateValue = new Date(m.value);
            if (m.matchMode === 'dateIs') {
              filter.startDate = dateValue;
              filter.endDate = dateValue;
            } else if (m.matchMode === 'dateAfter') {
              filter.startDate = dateValue;
            } else if (m.matchMode === 'dateBefore') {
              filter.endDate = dateValue;
            }
          }
        });
      } else {
        // If date filter is cleared in the UI
        filter.startDate = undefined;
        filter.endDate = undefined;
      }

      const merchantAndDescFilter = event.filters['merchantAndDesc'];
      if (merchantAndDescFilter) {
        const metadata = Array.isArray(merchantAndDescFilter) ? merchantAndDescFilter[0] : merchantAndDescFilter;
        filter.merchant = metadata.value?.merchant || undefined;
        filter.description = metadata.value?.description || undefined;
      } else {
        filter.merchant = undefined;
        filter.description = undefined;
      }

      const categoryFilter = event.filters['categoryName'];
      if (categoryFilter) {
        const metadata = Array.isArray(categoryFilter) ? categoryFilter[0] : categoryFilter;
        filter.categoryName = metadata.value || undefined;
      } else {
        filter.categoryName = undefined;
      }

      const accountFilter = event.filters['accountId'];
      if (accountFilter) {
        const metadata = Array.isArray(accountFilter) ? accountFilter[0] : accountFilter;
        filter.accountId = metadata.value || undefined;
      } else {
        filter.accountId = undefined;
      }
    }

    const currentState: TransactionState = this.state();
    if (page !== currentState.page ||
      rows !== currentState.size ||
      sort !== currentState.sort ||
      JSON.stringify(filter) !== JSON.stringify(currentState.filter)) {

      this.state.set({
        filter,
        page,
        size: rows,
        sort
      });
    }
  }

  clearFilters(): void {
    this.state.update((s: TransactionState) => ({...s, filter: {}, page: 0}));
  }

  updateMerchantFilter(filterConstraint: any, merchant: string | null): void {
    const currentDescription = filterConstraint.value?.description || null;
    if (!merchant && !currentDescription) {
      filterConstraint.value = null;
    } else {
      filterConstraint.value = {merchant, description: currentDescription};
    }
  }

  updateDescriptionFilter(filterConstraint: any, description: string | null): void {
    const currentMerchant = filterConstraint.value?.merchant || null;
    const desc = description?.trim() || null;
    if (!desc && !currentMerchant) {
      filterConstraint.value = null;
    } else {
      filterConstraint.value = {merchant: currentMerchant, description: desc};
    }
  }

  openCreateDialog(): void {
    this.selectedTransaction.set(null);
    this.showDialog.set(true);
  }

  openEditDialog(txn: Transaction): void {
    this.selectedTransaction.set(txn);
    this.showDialog.set(true);
  }

  onSave(formData: TransactionCreateRequest | TransactionUpdateRequest): void {
    const existing: Transaction | null = this.selectedTransaction();
    this.savingTransaction.set(true);

    let payload;
    if (existing) {
      payload = {
        id: existing.id,
        amount: formData.amount,
        transactionDate: formData.transactionDate,
        description: formData.description || '',
        type: formData.type,
        categoryId: formData.categoryId,
        merchantId: formData.merchantId
      } as TransactionUpdateRequest;
    } else {
      payload = {
        accountId: formData.accountId,
        amount: formData.amount,
        transactionDate: formData.transactionDate,
        description: formData.description || '',
        type: formData.type,
        categoryId: formData.categoryId,
        merchantId: formData.merchantId
      } as TransactionCreateRequest;
    }

    const op: Observable<number> = existing
      ? this.transactionApi.updateTransaction(payload as TransactionUpdateRequest)
      : this.transactionApi.createTransaction(payload as TransactionCreateRequest);

    op.pipe(finalize((): void => this.savingTransaction.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success(`Transaction ${existing ? 'updated' : 'created'}`);
          this.showDialog.set(false);
          this.loadTransactions();
        },
        error: (err: any): void => this.toast.error(err.error?.detail || 'Operation failed')
      });
  }

  deleteTransaction(txn: Transaction): void {
    this.confirmationService.confirm({
      header: 'Delete Transaction?',
      message: 'This will permanently remove this record. Continue?',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.transactionApi.deleteTransaction(txn.id).subscribe({
          next: (): void => {
            this.toast.success('Transaction deleted');
            this.loadTransactions();
          },
          error: (err: any): void => this.toast.error('Failed to delete transaction.')
        });
      }
    });
  }

  onImportComplete(): void {
    this.showImportDialog.set(false);
    this.showTransferDialog.set(true);
    this.loadTransactions();
  }
}
