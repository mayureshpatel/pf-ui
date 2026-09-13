import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  Signal,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { finalize, forkJoin, Observable, of, skip, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, FilterMetadata } from 'primeng/api';
import { ContextMenuModule } from 'primeng/contextmenu';
import { DatePicker } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';

import {
  PageResponse,
  Transaction,
  TransactionCreateRequest,
  TransactionFilter,
  TransactionFormSaveEvent,
  TransactionState,
  TransactionUpdateRequest,
} from '@models/transaction.model';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Tag } from '@models/tag.model';
import { TransactionApiService } from './services/transaction-api.service';
import { TransactionUrlStateService } from './services/transaction-url-state.service';
import {
  setAmountFilter,
  setDateFilter,
  setEqualsFilter,
  setMerchantFilter,
  updateCompositeFilterField,
} from './services/transaction-filter.util';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { TagApiService } from '@features/tags/services/tag-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { FormatTransactionTypeAmountPipe } from '@shared/pipes/format-transaction-type-amount.pipe';
import { TransactionFormDrawerComponent } from './components/transaction-form-drawer/transaction-form-drawer.component';
import { CsvImportDialogComponent } from './components/csv-import-dialog/csv-import-dialog.component';
import { TransferMatchingDialogComponent } from './components/transfer-matching-dialog/transfer-matching-dialog.component';
import {
  BulkEditData,
  BulkEditDialogComponent,
} from './components/bulk-edit-dialog/bulk-edit-dialog.component';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { toApiDateTimeString } from '@shared/utils/transaction.utils';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';

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
    BulkEditDialogComponent,
    FormatTransactionTypeAmountPipe,
    PageErrorStateComponent,
  ],
  providers: [FormatCurrencyPipe, FormatTransactionTypeAmountPipe],
  templateUrl: './transactions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsComponent implements OnInit {
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly urlState: TransactionUrlStateService = inject(TransactionUrlStateService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly tagApi: TagApiService = inject(TagApiService);
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
    sort: 'date,desc',
  });

  /** The dataset of transactions currently loaded in the view. */
  readonly transactions: WritableSignal<Transaction[]> = signal([]);

  /** Available bank/financial accounts. */
  readonly accounts: WritableSignal<Account[]> = signal([]);

  /** All known categories for autocomplete and assignment. */
  readonly categories: WritableSignal<Category[]> = signal([]);

  /** All known merchants for autocomplete and assignment. */
  readonly merchants: WritableSignal<Merchant[]> = signal([]);

  /** All known tags, for the filter dropdown and the edit drawer's tag picker. */
  readonly tags: WritableSignal<Tag[]> = signal([]);

  /** Global loading state for ledger refresh. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Whether the most recent load attempt failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Indicates if a single transaction is currently being saved. */
  readonly savingTransaction: WritableSignal<boolean> = signal(false);

  /** Indicates if a bulk-edit save operation is currently in flight. */
  readonly bulkSaving: WritableSignal<boolean> = signal(false);

  /** Indicates if the transaction form drawer is currently open. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the import dialog is currently open. */
  readonly showImportDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the bulk edit dialog is currently open. */
  readonly showBulkEditDialog: WritableSignal<boolean> = signal(false);

  /** Indicates if the transfer matching dialog is currently open. */
  readonly showTransferDialog: WritableSignal<boolean> = signal(false);

  /** User selection state for bulk actions. */
  readonly selectedTransactions: WritableSignal<Transaction[]> = signal([]);

  /** The transaction currently target for editing. */
  readonly selectedTransaction: WritableSignal<Transaction | null> = signal(null);

  /** The total number of records matching the current filter (for pagination). */
  readonly totalRecords: WritableSignal<number> = signal(0);

  /** Available transaction types for filtering. */
  readonly transactionTypeOptions: { label: string; value: string }[] = [
    { label: 'Income', value: 'INCOME' },
    { label: 'Expense', value: 'EXPENSE' },
    { label: 'Transfer', value: 'TRANSFER' },
    { label: 'Adjustment', value: 'ADJUSTMENT' },
  ];

  /** Unique merchant names for filtering. */
  readonly uniqueMerchantNames: Signal<string[]> = computed((): string[] => {
    const names: string[] = this.merchants().map(
      (m: Merchant): string => m.cleanName || m.originalName || 'Unknown Merchant',
    );
    return [...new Set(names)].sort((a: string, b: string): number => a.localeCompare(b));
  });

  /** Grouped categories for filtering, only including sub-categories. */
  readonly groupedCategories: Signal<any[]> = computed((): any[] => {
    const categories: Category[] = this.categories();
    const subCategories: Category[] = categories.filter((c: Category): boolean => !!c.parent);

    const groups = new Map<number, any>();

    subCategories.forEach((cat: Category): void => {
      const parentId: number = cat.parent!.id;
      if (!groups.has(parentId)) {
        groups.set(parentId, {
          label: cat.parent!.name || 'Unknown Category',
          value: parentId,
          items: [],
        });
      }
      groups.get(parentId).items.push({
        label: cat.name,
        value: cat.name,
      });
    });

    const result = Array.from(groups.values()).sort((a: any, b: any): number =>
      a.label.localeCompare(b.label),
    );
    result.unshift({
      label: 'Special',
      value: -1,
      items: [{ label: 'Uncategorized', value: '__UNDEFINED__' }],
    });

    return result;
  });

  /** Maps internal transaction state to PrimeNG filter metadata for UI synchronization. */
  readonly tableFilters: Signal<Record<string, FilterMetadata | FilterMetadata[]>> = computed(
    () => {
      const filter: TransactionFilter = this.state().filter;
      const filters: Record<string, FilterMetadata | FilterMetadata[]> = {
        date: [{ value: null, matchMode: 'dateIs', operator: 'and' }],
        merchantAndDesc: [{ value: null, matchMode: 'custom', operator: 'and' }],
        categoryName: [
          { value: filter.categoryName || null, matchMode: 'equals', operator: 'and' },
        ],
        accountId: [{ value: filter.accountId || null, matchMode: 'equals', operator: 'and' }],
        tagId: [{ value: filter.tagId || null, matchMode: 'equals', operator: 'and' }],
        amount: [{ value: null, matchMode: 'custom', operator: 'and' }],
      };

      if (filter.startDate || filter.endDate) {
        const dateFilters: FilterMetadata[] = [];
        if (
          filter.startDate &&
          filter.endDate &&
          filter.startDate.getTime() === filter.endDate.getTime()
        ) {
          dateFilters.push({ value: filter.startDate, matchMode: 'dateIs', operator: 'and' });
        } else {
          if (filter.startDate) {
            dateFilters.push({ value: filter.startDate, matchMode: 'dateAfter', operator: 'and' });
          }
          if (filter.endDate) {
            dateFilters.push({ value: filter.endDate, matchMode: 'dateBefore', operator: 'and' });
          }
        }
        filters['date'] = dateFilters;
      }

      if (filter.merchant || filter.description) {
        filters['merchantAndDesc'] = [
          {
            value: { merchant: filter.merchant || null, description: filter.description || null },
            matchMode: 'custom',
            operator: 'and',
          },
        ];
      }

      if (filter.minAmount !== undefined || filter.maxAmount !== undefined || filter.type) {
        filters['amount'] = [
          {
            value: {
              min: filter.minAmount ?? null,
              max: filter.maxAmount ?? null,
              type: filter.type ?? null,
            },
            matchMode: 'custom',
            operator: 'and',
          },
        ];
      }

      return filters;
    },
  );

  /** Indicates if the current dataset is empty. */
  readonly isEmpty: Signal<boolean> = computed(
    (): boolean => this.transactions().length === 0 && !this.loading(),
  );

  /** Indicates if all visible transactions are currently selected. */
  readonly allSelected: Signal<boolean> = computed(
    (): boolean =>
      this.selectedTransactions().length > 0 &&
      this.selectedTransactions().length === this.transactions().length,
  );

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
    this.loadTags();

    this.route.queryParams
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.hydrateFromParams(params));
  }

  /**
   * Fetches the transaction dataset from the API based on current state.
   */
  loadTransactions(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const { filter, page, size, sort } = this.state();

    this.transactionApi
      .getTransactions(filter, { page, size, sort })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
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
          this.loadError.set(true);
        },
      });
  }

  /**
   * Translates URL query parameters into internal signal state, via {@link TransactionUrlStateService}.
   * Skips the write if the resulting state is unchanged, to avoid redundantly re-triggering the
   * constructor's sync effect.
   * @param params - The query parameters from the active route.
   */
  private hydrateFromParams(params: Params): void {
    const newState: TransactionState = this.urlState.hydrateFromParams(params);
    const currentState: TransactionState = this.state();

    if (JSON.stringify(newState) !== JSON.stringify(currentState)) {
      this.state.set(newState);
    }
  }

  /**
   * Serializes the current signal state to URL query parameters, via
   * {@link TransactionUrlStateService}, then navigates to reflect them.
   * @param state - The current transaction state.
   */
  private updateUrlParams(state: TransactionState): void {
    const queryParams: Params = this.urlState.buildQueryParams(state);

    this.router.navigate([], {
      queryParams,
      queryParamsHandling: 'replace',
      replaceUrl: true,
    });
  }

  /**
   * Loads all the accounts for the current user.
   * @private
   */
  private loadAccounts(): void {
    this.accountApi
      .getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Account[]): void => this.accounts.set(data));
  }

  /**
   * Loads all the categories for the current user.
   * @private
   */
  private loadCategories(): void {
    this.categoryApi
      .getCategoriesWithTransactions()
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
    this.categoryApi
      .getMerchantsWithTransactions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Merchant[]): void => this.merchants.set(data));
  }

  /**
   * Loads all the tags for the current user.
   * @private
   */
  private loadTags(): void {
    this.tagApi
      .getTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: Tag[]): void => this.tags.set(data));
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
        sort,
      });
    }
  }

  hydrateFilters(
    filterEvent: Record<string, FilterMetadata | FilterMetadata[]>,
  ): TransactionFilter {
    const stateFilter: TransactionFilter = { ...this.state().filter };

    if (filterEvent) {
      setDateFilter(filterEvent['date'], stateFilter);
      setMerchantFilter(filterEvent['merchantAndDesc'], stateFilter);
      setEqualsFilter(filterEvent['categoryName'], stateFilter, 'categoryName');
      setEqualsFilter(filterEvent['accountId'], stateFilter, 'accountId');
      setEqualsFilter(filterEvent['tagId'], stateFilter, 'tagId');
      setAmountFilter(filterEvent['amount'], stateFilter);
    }

    return stateFilter;
  }

  /**
   * Clears the current transaction filter state.
   */
  clearFilters(): void {
    this.state.update((s: TransactionState) => ({
      ...s,
      filter: {},
      page: 0,
      sort: 'date,desc',
    }));
  }

  /**
   * Updates the merchant filter state.
   * @param filterConstraint the new filter constraint
   * @param merchant the new merchant name
   */
  updateMerchantFilter(filterConstraint: FilterMetadata, merchant: string | null): void {
    updateCompositeFilterField(
      filterConstraint,
      ['merchant', 'description'],
      'merchant',
      merchant,
      {
        isEmpty: (v: unknown): boolean => !v,
      },
    );
  }

  /**
   * Updates the description filter state.
   * @param filterConstraint the new filter constraint
   * @param description the new description
   */
  updateDescriptionFilter(filterConstraint: FilterMetadata, description: string | null): void {
    updateCompositeFilterField(
      filterConstraint,
      ['merchant', 'description'],
      'description',
      description,
      {
        normalize: (v: unknown): unknown => (v as string | null)?.trim() || null,
        isEmpty: (v: unknown): boolean => !v,
      },
    );
  }

  /**
   * Updates the minimum amount filter state.
   * @param filterConstraint the new filter constraint
   * @param min the new minimum amount
   */
  updateMinAmountFilter(filterConstraint: FilterMetadata, min: number | null): void {
    updateCompositeFilterField(filterConstraint, ['min', 'max', 'type'], 'min', min);
  }

  /**
   * Updates the maximum amount filter state.
   * @param filterConstraint the new filter constraint
   * @param max the new maximum amount
   */
  updateMaxAmountFilter(filterConstraint: FilterMetadata, max: number | null): void {
    updateCompositeFilterField(filterConstraint, ['min', 'max', 'type'], 'max', max);
  }

  /**
   * Updates the transaction type filter state.
   * @param filterConstraint the new filter constraint
   * @param type the new transaction type
   */
  updateTypeFilter(filterConstraint: FilterMetadata, type: string | null): void {
    updateCompositeFilterField(filterConstraint, ['min', 'max', 'type'], 'type', type);
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
   * Saves the transaction form data. Handles saving either a new transaction or updating an
   * existing one, then reconciles tag assignment against the transaction's previous tags (a new
   * transaction has none yet, so every selected tag is an addition).
   * @param event the form data and the full set of tag ids the user selected
   */
  onSave(event: TransactionFormSaveEvent): void {
    const { request: formData, tagIds } = event;
    const existing: Transaction | null = this.selectedTransaction();
    this.savingTransaction.set(true);

    let payload: TransactionCreateRequest | TransactionUpdateRequest;
    if (existing) {
      payload = {
        id: existing.id,
        accountId: formData.accountId,
        amount: formData.amount,
        transactionDate: toApiDateTimeString(formData.transactionDate),
        description: formData.description || '',
        type: formData.type,
        categoryId: formData.categoryId,
        merchantId: formData.merchantId,
      } as TransactionUpdateRequest;
    } else {
      payload = {
        accountId: (formData as TransactionCreateRequest).accountId,
        amount: formData.amount,
        transactionDate: toApiDateTimeString(formData.transactionDate),
        description: formData.description || '',
        type: formData.type,
        categoryId: formData.categoryId,
        merchantId: formData.merchantId,
      } as TransactionCreateRequest;
    }

    const op: Observable<number> = existing
      ? this.transactionApi.updateTransaction(payload as TransactionUpdateRequest)
      : this.transactionApi.createTransaction(payload as TransactionCreateRequest);

    op.pipe(
      switchMap((result: number): Observable<unknown> => {
        // updateTransaction resolves to a rows-affected count, not the transaction's own id --
        // use the already-known existing.id for that case; createTransaction resolves to the
        // real new id.
        const transactionId: number = existing ? existing.id : result;
        const previousTagIds: number[] = (existing?.tags ?? []).map((t: Tag): number => t.id);
        return this.syncTags(transactionId, previousTagIds, tagIds);
      }),
      finalize((): void => this.savingTransaction.set(false)),
    ).subscribe({
      next: (): void => {
        this.toast.success(`Transaction ${existing ? 'updated' : 'created'}`);
        this.showDialog.set(false);
        this.loadTransactions();
      },
      error: (err: any): void => this.toast.error(err.error?.detail || 'Operation failed'),
    });
  }

  /**
   * Reconciles a transaction's tag assignments against a new full selection: assigns whatever's
   * newly present, removes whatever's no longer present. A no-op (completes immediately) when
   * nothing changed.
   * @param transactionId the transaction to reconcile tags on
   * @param previousTagIds the tag ids it carried before this save
   * @param newTagIds the full set of tag ids the user selected
   * @private
   */
  private syncTags(
    transactionId: number,
    previousTagIds: number[],
    newTagIds: number[],
  ): Observable<unknown> {
    const toAdd: number[] = newTagIds.filter((id: number): boolean => !previousTagIds.includes(id));
    const toRemove: number[] = previousTagIds.filter(
      (id: number): boolean => !newTagIds.includes(id),
    );

    const ops: Observable<void>[] = [
      ...toAdd.map((tagId: number): Observable<void> =>
        this.tagApi.assignToTransaction(tagId, transactionId),
      ),
      ...toRemove.map((tagId: number): Observable<void> =>
        this.tagApi.removeFromTransaction(tagId, transactionId),
      ),
    ];

    return ops.length > 0 ? forkJoin(ops) : of(null);
  }

  /**
   * Applies a mass-edit configuration to every currently-selected transaction. Each toggled-on
   * field overrides that transaction's own current value; toggled-off fields pass through
   * unchanged -- `TransactionUpdateRequest` requires the full set of fields per transaction, not
   * just the ones being changed (a PATCH endpoint, but not a partial-object one).
   * @param data the finalized mass-edit configuration from BulkEditDialogComponent
   */
  onBulkSave(data: BulkEditData): void {
    this.bulkSaving.set(true);

    const updates: TransactionUpdateRequest[] = this.selectedTransactions().map(
      (txn: Transaction) =>
        ({
          id: txn.id,
          accountId: txn.account.id,
          amount: txn.amount,
          transactionDate: txn.date,
          description: data.updateDescription ? data.description! : txn.description,
          type: txn.type,
          categoryId: data.updateCategory ? data.category!.id : txn.category?.id,
          merchantId: data.updateMerchant ? data.merchant!.id : txn.merchant?.id,
        }) as TransactionUpdateRequest,
    );

    this.transactionApi
      .bulkUpdateTransactions(updates)
      .pipe(finalize((): void => this.bulkSaving.set(false)))
      .subscribe({
        next: (count: number): void => {
          this.toast.success(`${count} transaction${count === 1 ? '' : 's'} updated`);
          this.showBulkEditDialog.set(false);
          this.selectedTransactions.set([]);
          this.loadTransactions();
        },
        error: (err: any): void => this.toast.error(err.error?.detail || 'Bulk update failed'),
      });
  }

  /**
   * Deletes a transaction.
   * @param txn the transaction to delete
   */
  deleteTransaction(txn: Transaction): void {
    this.confirmationService.confirm({
      header: 'Delete Transaction?',
      message: 'This will permanently remove this record. Continue?',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.transactionApi
          .deleteTransaction(txn.id)
          .pipe(finalize((): void => this.savingTransaction.set(false)))
          .subscribe({
            next: (): void => {
              this.toast.success('Transaction deleted');
              this.loadTransactions();
            },
            error: (err: any): void => {
              console.error('Failed to delete transaction:', err);
              this.toast.error('Failed to delete transaction.');
            },
          });
      },
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
