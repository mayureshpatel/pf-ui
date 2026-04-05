import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  Signal,
  signal,
  untracked,
  WritableSignal
} from "@angular/core";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {ActivatedRoute, Params, Router} from "@angular/router";
import {finalize, Observable, skip} from "rxjs";
import {ButtonModule} from "primeng/button";
import {TableModule} from "primeng/table";
import {CardModule} from "primeng/card";
import {TooltipModule} from "primeng/tooltip";
import {CheckboxModule} from "primeng/checkbox";
import {TagModule} from "primeng/tag";
import {InputNumberModule} from "primeng/inputnumber";
import {InputTextModule} from "primeng/inputtext";
import {ConfirmationService, FilterMetadata} from "primeng/api";
import {ContextMenuModule} from "primeng/contextmenu";
import {DatePicker} from "primeng/datepicker";
import {SelectModule} from "primeng/select";

import {
  PageResponse,
  Transaction,
  TransactionCreateRequest,
  TransactionFilter,
  TransactionState,
  TransactionType,
  TransactionUpdateRequest
} from "@models/transaction.model";
import {Account} from "@models/account.model";
import {Category} from "@models/category.model";
import {Merchant} from "@models/merchant.model";
import {TransactionApiService} from "./services/transaction-api.service";
import {AccountApiService} from "@features/accounts/services/account-api.service";
import {CategoryApiService} from "@features/categories/services/category-api.service";
import {ToastService} from "@core/services/toast.service";
import {ScreenToolbarComponent} from "@shared/components/screen-toolbar/screen-toolbar";
import {FormatTransactionTypeAmountPipe} from "@shared/pipes/format-transaction-type-amount.pipe";
import {TransactionFormDrawerComponent} from "./components/transaction-form-drawer/transaction-form-drawer.component";
import {CsvImportDialog} from "./components/csv-import-dialog/csv-import-dialog.component";
import {
  TransferMatchingDialogComponent
} from "./components/transfer-matching-dialog/transfer-matching-dialog.component";
import {FormatCurrencyPipe} from "@shared/pipes/format-currency.pipe";

/**
 * Component for managing and auditing the master transaction ledger.
 *
 * Provides high-fidelity filtering, bulk operations, CSV imports, and
 * intelligent transfer matching.
 */
@Component({
  selector: "app-transactions",
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
    CsvImportDialog,
    TransferMatchingDialogComponent,
    FormatTransactionTypeAmountPipe
  ],
  providers: [FormatCurrencyPipe, FormatTransactionTypeAmountPipe],
  templateUrl: "./transactions.component.html"
})
export class TransactionsComponent implements OnInit {
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
    sort: "date,desc"
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

  /** Available transaction types for filtering. */
  readonly transactionTypeOptions: { label: string; value: string }[] = [
    {label: "Income", value: "INCOME"},
    {label: "Expense", value: "EXPENSE"},
    {label: "Transfer", value: "TRANSFER"},
    {label: "Adjustment", value: "ADJUSTMENT"}
  ];

  /** Unique merchant names for filtering. */
  readonly uniqueMerchantNames: Signal<string[]> = computed((): string[] => {
    const names: string[] = this.merchants()
      .map((m: Merchant): string => m.cleanName)
      .filter((name: string): name is string => !!name);
    return [...new Set(names)].sort((a: string, b: string): number => a.localeCompare(b));
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

    const result = Array.from(groups.values()).sort((a: any, b: any): number => a.label.localeCompare(b.label));
    result.unshift({
      label: "Special",
      value: -1,
      items: [{label: "Uncategorized", value: "__UNDEFINED__"}]
    });

    return result;
  });

  /** Maps internal transaction state to PrimeNG filter metadata for UI synchronization. */
  readonly tableFilters: Signal<{ [key: string]: FilterMetadata | FilterMetadata[] }> = computed(() => {
    const filter: TransactionFilter = this.state().filter;
    const filters: { [key: string]: FilterMetadata | FilterMetadata[] } = {
      date: [{value: null, matchMode: "dateIs", operator: "and"}],
      merchantAndDesc: [{value: null, matchMode: "custom", operator: "and"}],
      categoryName: [{value: filter.categoryName || null, matchMode: "equals", operator: "and"}],
      accountId: [{value: filter.accountId || null, matchMode: "equals", operator: "and"}],
      amount: [{value: null, matchMode: "custom", operator: "and"}]
    };

    if (filter.startDate || filter.endDate) {
      const dateFilters: FilterMetadata[] = [];
      if (filter.startDate && filter.endDate && filter.startDate.getTime() === filter.endDate.getTime()) {
        dateFilters.push({value: filter.startDate, matchMode: "dateIs", operator: "and"});
      } else {
        if (filter.startDate) {
          dateFilters.push({value: filter.startDate, matchMode: "dateAfter", operator: "and"});
        }
        if (filter.endDate) {
          dateFilters.push({value: filter.endDate, matchMode: "dateBefore", operator: "and"});
        }
      }
      filters["date"] = dateFilters;
    }

    if (filter.merchant || filter.description) {
      filters["merchantAndDesc"] = [
        {
          value: {merchant: filter.merchant || null, description: filter.description || null},
          matchMode: "custom",
          operator: "and"
        }
      ];
    }

    if (filter.minAmount !== undefined || filter.maxAmount !== undefined || filter.type) {
      filters["amount"] = [
        {
          value: {min: filter.minAmount ?? null, max: filter.maxAmount ?? null, type: filter.type ?? null},
          matchMode: "custom",
          operator: "and"
        }
      ];
    }

    return filters;
  });

  /** Indicates if the current dataset is empty. */
  readonly isEmpty: Signal<boolean> = computed((): boolean => this.transactions().length === 0 && !this.loading());

  /** Indicates if all visible transactions are currently selected. */
  readonly allSelected: Signal<boolean> = computed(
    (): boolean => this.selectedTransactions().length > 0 && this.selectedTransactions().length === this.transactions().length
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

    this.route.queryParams
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.hydrateFromParams(params));
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
          console.error("Failed to load transactions:", err);
          this.toast.error("Failed to refresh ledger.");
        }
      });
  }

  /**
   * Translates URL query parameters into internal signal state.
   * @param params - The query parameters from the active route.
   */
  private hydrateFromParams(params: Params): void {
    const filter: TransactionFilter = {
      accountId: params["accountId"] ? Number(params["accountId"]) : undefined,
      type: (params["type"] as TransactionType) || undefined,
      description: params["description"] || undefined,
      merchant: params["merchant"] || undefined,
      categoryName: params["categoryName"] || undefined,
      minAmount: Number(params["minAmount"] ?? undefined),
      maxAmount: Number(params["maxAmount"] ?? undefined),
      startDate: params["startDate"] ? new Date(params["startDate"]) : undefined,
      endDate: params["endDate"] ? new Date(params["endDate"]) : undefined
    };

    const page: number = params["page"] ? Number(params["page"]) : 0;
    const size: number = params["size"] ? Number(params["size"]) : 20;
    const sort: string = params["sort"] || "date,desc";

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

    if (filter.accountId) queryParams["accountId"] = filter.accountId;
    if (filter.type) queryParams["type"] = filter.type;
    if (filter.description) queryParams["description"] = filter.description;
    if (filter.merchant) queryParams["merchant"] = filter.merchant;
    if (filter.categoryName) queryParams["categoryName"] = filter.categoryName;
    if (filter.minAmount !== undefined) queryParams["minAmount"] = filter.minAmount;
    if (filter.maxAmount !== undefined) queryParams["maxAmount"] = filter.maxAmount;
    if (filter.startDate) queryParams["startDate"] = filter.startDate;
    if (filter.endDate) queryParams["endDate"] = filter.endDate;

    if (page > 0) queryParams["page"] = page;
    if (size !== 20) queryParams["size"] = size;
    if (sort !== "date,desc") queryParams["sort"] = sort;

    this.router.navigate([], {
      queryParams,
      queryParamsHandling: "replace",
      replaceUrl: true
    });
  }

  /**
   * Loads all the accounts for the current user.
   * @private
   */
  private loadAccounts(): void {
    this.accountApi.getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Account[]): void => this.accounts.set(data));
  }

  /**
   * Loads all the categories for the current user.
   * @private
   */
  private loadCategories(): void {
    this.categoryApi.getCategoriesWithTransactions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Category[]): void => this.categories.set(data));
  }

  /**
   * Loads all the merchants associated with the current user.
   * <br><br>
   * Gets distinct merchant names from all transactions for the current user.
   * @private
   */
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
      const dir: string = event.sortOrder === 1 ? "asc" : "desc";
      sort = `${event.sortField},${dir}`;
    }

    const filter: TransactionFilter = this.hydrateFilters(event.filters);
    const currentState: TransactionState = this.state();
    if (
      page !== currentState.page ||
      rows !== currentState.size ||
      sort !== currentState.sort ||
      JSON.stringify(filter) !== JSON.stringify(currentState.filter)
    ) {
      this.state.set({
        filter,
        page,
        size: rows,
        sort
      });
    }
  }

  hydrateFilters(filterEvent: any): TransactionFilter {
    const stateFilter: TransactionFilter = {...this.state().filter};

    if (filterEvent) {
      this.setDateFilter(filterEvent["date"], stateFilter);
      this.setMerchantFilter(filterEvent["merchantAndDesc"], stateFilter);
      this.setCategoryFilter(filterEvent["categoryName"], stateFilter);
      this.setAccountIdFilter(filterEvent["accountId"], stateFilter);
      this.setAmountFilter(filterEvent["amount"], stateFilter);
    }

    return stateFilter;
  }

  /**
   * Sets the date filter for the current transaction filter state.
   * @param dateFilter the date filter object; from the event
   * @param stateFilter the transaction filter state object
   * @private
   */
  private setDateFilter(dateFilter: any, stateFilter: TransactionFilter): void {
    if (dateFilter) {
      const metadata = Array.isArray(dateFilter) ? dateFilter : [dateFilter];
      stateFilter.startDate = undefined;
      stateFilter.endDate = undefined;

      metadata.forEach((m: FilterMetadata): void => {
        if (m.value) {
          const dateValue = new Date(m.value);
          if (m.matchMode === "dateIs") {
            stateFilter.startDate = dateValue;
            stateFilter.endDate = dateValue;
          } else if (m.matchMode === "dateAfter") {
            stateFilter.startDate = dateValue;
          } else if (m.matchMode === "dateBefore") {
            stateFilter.endDate = dateValue;
          }
        }
      });
    } else {
      stateFilter.startDate = undefined;
      stateFilter.endDate = undefined;
    }
  }

  /**
   * Sets the merchant filter for the current transaction filter state.
   * @param merchantFilter the merchant filter object from the event; contains the merchant name and description
   * @param stateFilter the transaction filter state object
   * @private
   */
  private setMerchantFilter(merchantFilter: any, stateFilter: TransactionFilter): void {
    if (merchantFilter) {
      const metadata = Array.isArray(merchantFilter) ? merchantFilter[0] : merchantFilter;
      stateFilter.merchant = metadata.value?.merchant || undefined;
      stateFilter.description = metadata.value?.description || undefined;
    } else {
      stateFilter.merchant = undefined;
      stateFilter.description = undefined;
    }
  }

  /**
   * Sets the category filter for the current transaction filter state.
   * @param categoryFilter the category filter object from the event; contains the category name
   * @param stateFilter the transaction filter state object
   * @private
   */
  private setCategoryFilter(categoryFilter: any, stateFilter: TransactionFilter): void {
    if (categoryFilter) {
      const metadata = Array.isArray(categoryFilter) ? categoryFilter[0] : categoryFilter;
      stateFilter.categoryName = metadata.value || undefined;
    } else {
      stateFilter.categoryName = undefined;
    }
  }

  /**
   * Sets the account ID filter for the current transaction filter state.
   * @param accountFilter the account filter object from the event; contains the account ID
   * @param stateFilter the transaction filter state object
   * @private
   */
  private setAccountIdFilter(accountFilter: any, stateFilter: TransactionFilter): void {
    if (accountFilter) {
      const metadata = Array.isArray(accountFilter) ? accountFilter[0] : accountFilter;
      stateFilter.accountId = metadata.value || undefined;
    } else {
      stateFilter.accountId = undefined;
    }
  }

  /**
   * Sets the amount filter for the current transaction filter state.
   * @param amountFilter the amount filter object from the event; contains min, max, and type
   * @param stateFilter the transaction filter state object
   * @private
   */
  private setAmountFilter(amountFilter: any, stateFilter: TransactionFilter): void {
    if (amountFilter) {
      const metadata = Array.isArray(amountFilter) ? amountFilter[0] : amountFilter;
      stateFilter.minAmount = metadata.value?.min ?? undefined;
      stateFilter.maxAmount = metadata.value?.max ?? undefined;
      stateFilter.type = metadata.value?.type ?? undefined;
    } else {
      stateFilter.minAmount = undefined;
      stateFilter.maxAmount = undefined;
      stateFilter.type = undefined;
    }
  }

  /**
   * Clears the current transaction filter state.
   */
  clearFilters(): void {
    this.state.update((s: TransactionState) => ({
      ...s,
      filter: {},
      page: 0,
      sort: "date,desc"
    }));
  }

  /**
   * Updates the merchant filter state.
   * @param filterConstraint the new filter constraint
   * @param merchant the new merchant name
   */
  updateMerchantFilter(filterConstraint: any, merchant: string | null): void {
    const currentDescription = filterConstraint.value?.description || null;
    if (!merchant && !currentDescription) {
      filterConstraint.value = null;
    } else {
      filterConstraint.value = {merchant, description: currentDescription};
    }
  }

  /**
   * Updates the description filter state.
   * @param filterConstraint the new filter constraint
   * @param description the new description
   */
  updateDescriptionFilter(filterConstraint: any, description: string | null): void {
    const currentMerchant = filterConstraint.value?.merchant || null;
    const desc = description?.trim() || null;
    if (!desc && !currentMerchant) {
      filterConstraint.value = null;
    } else {
      filterConstraint.value = {merchant: currentMerchant, description: desc};
    }
  }

  /**
   * Updates the minimum amount filter state.
   * @param filterConstraint the new filter constraint
   * @param min the new minimum amount
   */
  updateMinAmountFilter(filterConstraint: any, min: number | null): void {
    const currentMax = filterConstraint.value?.max ?? null;
    const currentType = filterConstraint.value?.type ?? null;
    if (min === null && currentMax === null && currentType === null) {
      filterConstraint.value = null;
    } else {
      filterConstraint.value = {min, max: currentMax, type: currentType};
    }
  }

  /**
   * Updates the maximum amount filter state.
   * @param filterConstraint the new filter constraint
   * @param max the new maximum amount
   */
  updateMaxAmountFilter(filterConstraint: any, max: number | null): void {
    const currentMin = filterConstraint.value?.min ?? null;
    const currentType = filterConstraint.value?.type ?? null;
    if (max === null && currentMin === null && currentType === null) {
      filterConstraint.value = null;
    } else {
      filterConstraint.value = {min: currentMin, max, type: currentType};
    }
  }

  /**
   * Updates the transaction type filter state.
   * @param filterConstraint the new filter constraint
   * @param type the new transaction type
   */
  updateTypeFilter(filterConstraint: any, type: string | null): void {
    const currentMin = filterConstraint.value?.min ?? null;
    const currentMax = filterConstraint.value?.max ?? null;
    if (type === null && currentMin === null && currentMax === null) {
      filterConstraint.value = null;
    } else {
      filterConstraint.value = {min: currentMin, max: currentMax, type};
    }
  }

  /**
   * Opens the create transaction dialog.
   */
  openCreateDialog(): void {
    this.selectedTransaction.set(null);
    this.showDialog.set(true);
  }

  /**
   * Opens the edit transaction dialog.
   * @param txn the transaction to edit
   */
  openEditDialog(txn: Transaction): void {
    this.selectedTransaction.set(txn);
    this.showDialog.set(true);
  }

  /**
   * Saves the transaction form data. Handles saving either a new transaction or updating an existing one.
   * @param formData the form data to save
   */
  onSave(formData: TransactionCreateRequest | TransactionUpdateRequest): void {
    const existing: Transaction | null = this.selectedTransaction();
    this.savingTransaction.set(true);

    let payload: TransactionCreateRequest | TransactionUpdateRequest;
    if (existing) {
      payload = {
        id: existing.id,
        amount: formData.amount,
        transactionDate: formData.transactionDate,
        description: formData.description || "",
        type: formData.type,
        categoryId: formData.categoryId,
        merchantId: formData.merchantId
      } as TransactionUpdateRequest;
    } else {
      payload = {
        accountId: formData.accountId,
        amount: formData.amount,
        transactionDate: formData.transactionDate,
        description: formData.description || "",
        type: formData.type,
        categoryId: formData.categoryId,
        merchantId: formData.merchantId
      } as TransactionCreateRequest;
    }

    const op: Observable<number> = existing
      ? this.transactionApi.updateTransaction(payload as TransactionUpdateRequest)
      : this.transactionApi.createTransaction(payload as TransactionCreateRequest);

    op.pipe(finalize((): void => this.savingTransaction.set(false))).subscribe({
      next: (): void => {
        this.toast.success(`Transaction ${existing ? "updated" : "created"}`);
        this.showDialog.set(false);
        this.loadTransactions();
      },
      error: (err: any): void => this.toast.error(err.error?.detail || "Operation failed")
    });
  }

  /**
   * Deletes a transaction.
   * @param txn the transaction to delete
   */
  deleteTransaction(txn: Transaction): void {
    this.confirmationService.confirm({
      header: "Delete Transaction?",
      message: "This will permanently remove this record. Continue?",
      acceptLabel: "Delete",
      rejectLabel: "Cancel",
      acceptButtonStyleClass: "p-button-danger",
      accept: (): void => {
        this.transactionApi.deleteTransaction(txn.id)
          .pipe(finalize((): void => this.savingTransaction.set(false)))
          .subscribe({
            next: (): void => {
              this.toast.success("Transaction deleted");
              this.loadTransactions();
            },
            error: (err: any): void => this.toast.error("Failed to delete transaction.")
          });
      }
    });
  }

  /**
   * Handles the completion of the import process.
   */
  onImportComplete(): void {
    this.showImportDialog.set(false);
    this.showTransferDialog.set(true);
    this.loadTransactions();
  }
}
