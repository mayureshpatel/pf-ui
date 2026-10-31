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
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { finalize, forkJoin, Observable, of, skip, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule } from 'primeng/paginator';
import { ConfirmationService, SelectItemGroup } from 'primeng/api';

import {
  PageResponse,
  Transaction,
  TransactionCreateRequest,
  TransactionFilter,
  TransactionFormSaveEvent,
  TransactionState,
  TransactionType,
  TransactionUpdateRequest,
} from '@models/transaction.model';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Tag } from '@models/tag.model';
import { TransactionApiService } from './services/transaction-api.service';
import { TransactionUrlStateService } from './services/transaction-url-state.service';
import { DashboardApiService } from '@features/dashboard/services/dashboard-api.service';
import { ActionItem, ActionType } from '@models/dashboard.model';
import { isSameTransactionState } from './utils/transaction-state';
import {
  describeEmptyPeriod,
  hasAnyFilter,
  hasOnlyPeriodFilter,
  presetRange,
} from './utils/transaction-period';
import { UNCATEGORIZED } from './utils/transaction-filter-chips';
import { TransactionFilterBarComponent } from './components/transaction-filter-bar/transaction-filter-bar.component';
import {
  ReviewTab,
  reviewTabId,
  TRANSACTIONS_TABPANEL_ID,
  TransactionReviewTabsComponent,
} from './components/transaction-review-tabs/transaction-review-tabs.component';
import { TransactionListComponent } from './components/transaction-list/transaction-list.component';
import { TransactionBulkBarComponent } from './components/transaction-bulk-bar/transaction-bulk-bar.component';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';
import { TransactionEditFormComponent } from './components/transaction-edit-form/transaction-edit-form.component';
import { TransactionBulkFormComponent } from './components/transaction-bulk-form/transaction-bulk-form.component';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { TagApiService } from '@features/tags/services/tag-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { CsvImportDialogComponent } from './components/csv-import-dialog/csv-import-dialog.component';
import { TransferMatchingDialogComponent } from './components/transfer-matching-dialog/transfer-matching-dialog.component';
import { BulkEditData } from './components/transaction-bulk-form/transaction-bulk-form.component';
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
    PaginatorModule,
    FormatCurrencyPipe,
    TransactionFilterBarComponent,
    TransactionReviewTabsComponent,
    TransactionListComponent,
    TransactionBulkBarComponent,
    SidePanelComponent,
    TransactionEditFormComponent,
    TransactionBulkFormComponent,
    ScreenToolbarComponent,
    CsvImportDialogComponent,
    TransferMatchingDialogComponent,
    PageErrorStateComponent,
  ],
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

  /** Indicates if a manual mark-as-transfer operation is currently in flight. */
  readonly markingAsTransfer: WritableSignal<boolean> = signal(false);

  /** Indicates if a manual unmark-as-transfer operation is currently in flight. */
  readonly unmarkingAsTransfer: WritableSignal<boolean> = signal(false);

  /** What the docked side panel is showing: closed, one transaction, a new one, or a bulk edit. */
  readonly panelMode: WritableSignal<'closed' | 'single' | 'create' | 'bulk'> = signal('closed');

  /** Counts for the review tabs (global, from the same data the dashboard banner uses). */
  readonly reviewCounts: WritableSignal<{ uncategorized: number; transfers: number }> = signal({
    uncategorized: 0,
    transfers: 0,
  });

  /** Indicates if the import dialog is currently open. */
  readonly showImportDialog: WritableSignal<boolean> = signal(false);

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
      (m: Merchant): string => m.name || 'Unknown Merchant',
    );
    return [...new Set(names)].sort((a: string, b: string): number => a.localeCompare(b));
  });

  /** Grouped categories for filtering, only including sub-categories. */
  readonly groupedCategories: Signal<SelectItemGroup<string>[]> = computed(
    (): SelectItemGroup<string>[] => {
      const categories: Category[] = this.categories();
      const subCategories: Category[] = categories.filter((c: Category): boolean => !!c.parent);

      const groups = new Map<number, SelectItemGroup<string>>();

      subCategories.forEach((cat: Category): void => {
        const parentId: number = cat.parent!.id;
        if (!groups.has(parentId)) {
          groups.set(parentId, {
            label: cat.parent!.name || 'Unknown Category',
            value: parentId,
            items: [],
          });
        }
        groups.get(parentId)!.items.push({
          label: cat.name,
          value: cat.name,
        });
      });

      const result: SelectItemGroup<string>[] = Array.from(groups.values()).sort(
        (a: SelectItemGroup<string>, b: SelectItemGroup<string>): number =>
          a.label.localeCompare(b.label),
      );
      result.unshift({
        label: 'Special',
        value: -1,
        items: [{ label: 'Uncategorized', value: UNCATEGORIZED }],
      });

      return result;
    },
  );

  /** Indicates if the current dataset is empty. */
  readonly isEmpty: Signal<boolean> = computed(
    (): boolean => this.transactions().length === 0 && !this.loading(),
  );

  /** The ids of the selected transactions (what the list's checkboxes show). */
  readonly selectedIds: Signal<number[]> = computed((): number[] =>
    this.selectedTransactions().map((t: Transaction): number => t.id),
  );

  /** True when every selected row is already a transfer, so the bar offers Unmark. */
  readonly allSelectedAreTransfers: Signal<boolean> = computed((): boolean => {
    const rows: Transaction[] = this.selectedTransactions();
    return (
      rows.length > 0 &&
      rows.every(
        (t: Transaction): boolean =>
          t.type === TransactionType.TRANSFER ||
          t.type === TransactionType.TRANSFER_IN ||
          t.type === TransactionType.TRANSFER_OUT,
      )
    );
  });

  /** Which review tab matches the applied category filter. */
  readonly activeTab: Signal<ReviewTab> = computed((): ReviewTab => {
    const category: string | undefined = this.state().filter.categoryName;
    return category === UNCATEGORIZED || category === '__UNDEFINED__' ? 'NEEDS_CATEGORY' : 'ALL';
  });

  /** The net of the selection (income minus expense; transfers and adjustments excluded). */
  readonly selectionNet: Signal<number> = computed((): number => {
    const net: number = this.selectedTransactions().reduce(
      (sum: number, t: Transaction): number => {
        if (t.type === TransactionType.INCOME) return sum + t.amount;
        if (t.type === TransactionType.EXPENSE) return sum - t.amount;
        return sum;
      },
      0,
    );
    return Math.round(net * 100) / 100;
  });

  /** How many pages the current result spans (at least one). */
  readonly pageCount: Signal<number> = computed((): number =>
    Math.max(1, Math.ceil(this.totalRecords() / this.state().size)),
  );

  /** Whether any filter other than an All time period is applied (drives the empty state). */
  readonly hasAnyActiveFilter: Signal<boolean> = computed((): boolean =>
    hasAnyFilter(this.state().filter),
  );

  /**
   * Whether any transaction exists at all, asked once when a period-only filter finds nothing.
   * Null until answered (or when not asked), so the page can tell "nothing yet" from "nothing in
   * this period".
   */
  readonly anyTransactionsExist: WritableSignal<boolean | null> = signal<boolean | null>(null);

  /** What to tell the user when the list is empty (see PF-867). */
  readonly emptyKind: Signal<'filtered' | 'period' | 'none' | 'checking'> = computed(() => {
    const filter: TransactionFilter = this.state().filter;
    if (hasAnyFilter(filter) && !hasOnlyPeriodFilter(filter)) return 'filtered';
    if (!hasOnlyPeriodFilter(filter)) return 'none';
    const exists: boolean | null = this.anyTransactionsExist();
    if (exists === null) return 'checking';
    return exists ? 'period' : 'none';
  });

  /** Headline for the empty state when only the period found nothing. */
  readonly emptyPeriodMessage: Signal<string> = computed((): string =>
    describeEmptyPeriod(
      { startDate: this.state().filter.startDate, endDate: this.state().filter.endDate },
      new Date(),
    ),
  );

  /** The panel the review tabs control, and the id of the tab that names it. */
  protected readonly tabPanelId: string = TRANSACTIONS_TABPANEL_ID;
  readonly activeTabId: Signal<string> = computed((): string => reviewTabId(this.activeTab()));

  /** Heading for the side panel. */
  readonly panelTitle: Signal<string> = computed((): string => {
    switch (this.panelMode()) {
      case 'create':
        return 'New transaction';
      case 'bulk':
        return `${this.selectedTransactions().length} selected`;
      default:
        return 'Edit transaction';
    }
  });

  private readonly dashboardApi: DashboardApiService = inject(DashboardApiService);
  private readonly editForm: Signal<TransactionEditFormComponent | undefined> =
    viewChild<TransactionEditFormComponent>('editForm');
  private readonly bulkForm: Signal<TransactionBulkFormComponent | undefined> =
    viewChild<TransactionBulkFormComponent>('bulkForm');

  /** Whether the visible panel form can be saved. */
  readonly panelValid: Signal<boolean> = computed((): boolean => {
    if (this.panelMode() === 'bulk') return this.bulkForm()?.valid() ?? false;
    // an incomplete single form keeps Save enabled: clicking it shows what needs fixing, which a
    // disabled button never can
    return true;
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
    this.handleActionParam(this.route.snapshot.queryParams);
    this.loadAccounts();
    this.loadCategories();
    this.loadMerchants();
    this.loadTags();

    this.route.queryParams
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.hydrateFromParams(params));
  }

  /**
   * Handles one-shot `?action=...` navigation triggers (distinct from the persistent filter/sort
   * state {@link TransactionUrlStateService} owns) -- currently just `review-transfers`, the
   * Dashboard's own link to here (PF-825's `TRANSFER_REVIEW` action item). Strips the param off
   * the URL once handled so a refresh or browser-back doesn't repeatedly reopen the dialog.
   * @param params - The query parameters from the active route.
   */
  private handleActionParam(params: Params): void {
    if (params['action'] !== 'review-transfers') return;

    this.showTransferDialog.set(true);
    const rest = { ...params };
    delete rest['action'];
    this.router.navigate([], { queryParams: rest, replaceUrl: true });
  }

  /**
   * Fetches the transaction dataset from the API based on current state.
   */
  loadTransactions(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.loadReviewCounts();
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
          this.checkForAnyTransactions(res.content.length === 0);
          // a selection never survives a reload, so bulk mode has nothing left to act on
          this.selectedTransactions.set([]);
          if (this.panelMode() === 'bulk') {
            this.closePanel();
          } else if (this.panelMode() === 'single') {
            const current: Transaction | null = this.selectedTransaction();
            const refreshed: Transaction | undefined = res.content.find(
              (t: Transaction): boolean => t.id === current?.id,
            );
            if (refreshed) {
              this.selectedTransaction.set(refreshed);
            } else {
              this.closePanel();
            }
          }
        },
        error: (err: unknown): void => {
          console.error('Failed to load transactions:', err);
          this.toast.error('Failed to refresh ledger.');
          // the old rows belong to the old filter, so do not leave them under the new filter
          // chips; with nothing to show the page falls back to the error state with a retry
          this.transactions.set([]);
          this.totalRecords.set(0);
          this.selectedTransactions.set([]);
          this.loadError.set(true);
        },
      });
  }

  /**
   * When a period-only filter finds nothing, asks whether any transaction exists at all, so the
   * empty state can say "no transactions yet" for a new user and name the period otherwise.
   */
  private checkForAnyTransactions(emptyResult: boolean): void {
    this.anyTransactionsExist.set(null);
    if (!emptyResult || !hasOnlyPeriodFilter(this.state().filter)) return;
    this.transactionApi
      .getTransactions({}, { page: 0, size: 1, sort: this.state().sort })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: PageResponse<Transaction>): void =>
          this.anyTransactionsExist.set(res.page.totalElements > 0),
        // cannot tell, so fall back to the plain "nothing in this period" wording
        error: (): void => this.anyTransactionsExist.set(true),
      });
  }

  /**
   * Translates URL query parameters into internal signal state, via {@link TransactionUrlStateService}.
   * Skips the write if the resulting state is unchanged, to avoid redundantly re-triggering the
   * constructor's sync effect.
   * @param params - The query parameters from the active route.
   */
  private hydrateFromParams(params: Params): void {
    const hydrated: TransactionState = this.urlState.hydrateFromParams(params);
    // a bare /transactions shows This month; a URL that carries any filter, or says period=all,
    // shows what it asks for (the dashboard's uncategorized link would otherwise hide older rows)
    const useDefaultPeriod: boolean = params['period'] !== 'all' && !hasAnyFilter(hydrated.filter);
    const newState: TransactionState = useDefaultPeriod
      ? {
          ...hydrated,
          filter: { ...hydrated.filter, ...presetRange('THIS_MONTH', new Date()) },
        }
      : hydrated;
    const currentState: TransactionState = this.state();

    if (!isSameTransactionState(newState, currentState)) {
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

  /** Applies a new filter (period, search, popover, chips) and returns to the first page. */
  onFilterChange(filter: TransactionFilter): void {
    this.state.update((s: TransactionState) => ({ ...s, filter, page: 0 }));
  }

  /** Switches between All and Needs a category. */
  onTabChange(tab: ReviewTab): void {
    // clicking All while already on All must not silently drop other filters such as a category
    if (tab === 'ALL' && this.activeTab() === 'ALL') return;
    const filter: TransactionFilter = { ...this.state().filter };
    filter.categoryName = tab === 'NEEDS_CATEGORY' ? UNCATEGORIZED : undefined;
    this.onFilterChange(filter);
  }

  /** Applies a new sort and returns to the first page. */
  onSortChange(sort: string): void {
    this.state.update((s: TransactionState) => ({ ...s, sort, page: 0 }));
  }

  /** Applies a page or page-size change from the paginator. */
  onPageChange(event: { first?: number; rows?: number }): void {
    const rows: number = event.rows ?? this.state().size;
    this.state.update((s: TransactionState) => ({
      ...s,
      size: rows,
      page: Math.floor((event.first ?? 0) / rows),
    }));
  }

  /** Replaces the selection with the rows of the loaded page whose ids are given. */
  onSelectionChange(ids: number[]): void {
    this.selectedTransactions.set(
      this.transactions().filter((t: Transaction): boolean => ids.includes(t.id)),
    );
    if (ids.length === 0 && this.panelMode() === 'bulk') this.closePanel();
  }

  /** Opens the panel for the selection: bulk mode for many, single mode for one. */
  onEditMore(): void {
    const rows: Transaction[] = this.selectedTransactions();
    if (rows.length === 0) return;
    if (rows.length === 1) {
      this.openEditDialog(rows[0]);
    } else {
      this.confirmDiscardIfDirty((): void => this.panelMode.set('bulk'));
    }
  }

  /** Closes the panel from its own Close button or Escape, asking first if edits are unsaved. */
  onPanelClose(): void {
    this.confirmDiscardIfDirty((): void => this.closePanel());
  }

  /**
   * Runs an action that would replace the single-transaction form, after asking the user to
   * confirm if that form has unsaved changes. Anything else runs straight away.
   */
  private confirmDiscardIfDirty(proceed: () => void): void {
    const editing: boolean = this.panelMode() === 'single' || this.panelMode() === 'create';
    if (!editing || !this.editForm()?.form.dirty) {
      proceed();
      return;
    }
    this.confirmationService.confirm({
      header: 'Discard changes?',
      message: 'You have unsaved changes to this transaction. Discard them?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep editing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: proceed,
    });
  }

  /** Opens the panel on the row whose "Choose category" pill was clicked. */
  onPickCategory(txn: Transaction): void {
    this.openEditDialog(txn);
  }

  /** Closes the side panel. */
  closePanel(): void {
    this.panelMode.set('closed');
    this.selectedTransaction.set(null);
  }

  /** Saves whichever form the panel is showing. */
  onPanelSave(): void {
    if (this.panelMode() === 'bulk') {
      this.bulkForm()?.submit();
    } else {
      this.editForm()?.submit();
    }
  }

  /** Loads the counts shown on the review tabs. */
  private loadReviewCounts(): void {
    this.dashboardApi
      .getActionItems()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items: ActionItem[]): void => {
          const count = (type: ActionType): number =>
            items.find((i: ActionItem): boolean => i.type === type)?.count ?? 0;
          this.reviewCounts.set({
            uncategorized: count(ActionType.UNCATEGORIZED),
            transfers: count(ActionType.TRANSFER_REVIEW),
          });
        },
        error: (): void => this.reviewCounts.set({ uncategorized: 0, transfers: 0 }),
      });
  }

  /**
   * Opens the create transaction dialog.
   */
  openCreateDialog(): void {
    this.confirmDiscardIfDirty((): void => {
      this.selectedTransaction.set(null);
      this.panelMode.set('create');
    });
  }

  /**
   * Opens the edit transaction dialog.
   * @param txn the transaction to edit
   */
  openEditDialog(txn: Transaction): void {
    // clicking the row that is already open must not ask, or reset, anything
    if (this.panelMode() === 'single' && this.selectedTransaction()?.id === txn.id) return;
    this.confirmDiscardIfDirty((): void => {
      this.selectedTransaction.set(txn);
      this.panelMode.set('single');
    });
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
      };
    } else {
      payload = {
        accountId: formData.accountId,
        amount: formData.amount,
        transactionDate: toApiDateTimeString(formData.transactionDate),
        description: formData.description || '',
        type: formData.type,
        categoryId: formData.categoryId,
        merchantId: formData.merchantId,
      };
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
        // what is on screen is now what is saved, so closing should not ask about discarding
        this.editForm()?.form.markAsPristine();
        if (!existing) this.closePanel();
        this.loadTransactions();
      },
      error: (err: HttpErrorResponse): void =>
        this.toast.error(err.error?.detail || 'Operation failed'),
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
   * @param data the finalized mass-edit configuration from TransactionBulkFormComponent
   */
  onBulkSave(data: BulkEditData): void {
    this.bulkSaving.set(true);

    const updates: TransactionUpdateRequest[] = this.selectedTransactions().map(
      (txn: Transaction): TransactionUpdateRequest => ({
        id: txn.id,
        accountId: txn.account.id,
        amount: txn.amount,
        transactionDate: txn.date,
        description: data.updateDescription ? data.description! : txn.description,
        type: txn.type,
        categoryId: data.updateCategory ? data.category!.id : txn.category?.id,
        merchantId: data.updateMerchant ? data.merchant!.id : txn.merchant?.id,
      }),
    );

    this.transactionApi
      .bulkUpdateTransactions(updates)
      .pipe(finalize((): void => this.bulkSaving.set(false)))
      .subscribe({
        next: (count: number): void => {
          const what: string =
            data.updateCategory && !data.updateMerchant && !data.updateDescription
              ? 'Set category on'
              : data.updateMerchant && !data.updateCategory && !data.updateDescription
                ? 'Set merchant on'
                : 'Updated';
          this.toast.success(`${what} ${count} transaction${count === 1 ? '' : 's'}`);
          this.closePanel();
          this.selectedTransactions.set([]);
          this.loadTransactions();
        },
        error: (err: HttpErrorResponse): void =>
          this.toast.error(err.error?.detail || 'Bulk update failed'),
      });
  }

  /**
   * Manually marks every currently-selected transaction as a transfer, bypassing
   * TransferMatcher's automatic suggestions entirely (PF-831). The suggestion dialog's own
   * matching only ever fires on request against recent, not-yet-transfer-typed transactions --
   * there was previously no way to correct a pair it doesn't (or can't yet, e.g. the other half
   * hasn't been imported this session) suggest on its own.
   */
  onMarkAsTransfer(): void {
    const ids: number[] = this.selectedTransactions().map((txn: Transaction): number => txn.id);
    if (ids.length === 0) return;

    this.markingAsTransfer.set(true);
    this.transactionApi
      .markAsTransfer(ids)
      .pipe(finalize((): void => this.markingAsTransfer.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success(
            `${ids.length} transaction${ids.length === 1 ? '' : 's'} marked as transfer`,
          );
          this.selectedTransactions.set([]);
          this.loadTransactions();
        },
        error: (err: HttpErrorResponse): void =>
          this.toast.error(err.error?.detail || 'Failed to mark as transfer'),
      });
  }

  /**
   * Reverts every currently-selected transaction from a confirmed transfer back to plain
   * income/expense (PF-831) -- for correcting a wrongly-confirmed match, or reclassifying data
   * affected by a heuristic fix (e.g. PF-848's backfill).
   */
  onUnmarkAsTransfer(): void {
    const ids: number[] = this.selectedTransactions().map((txn: Transaction): number => txn.id);
    if (ids.length === 0) return;

    this.unmarkingAsTransfer.set(true);
    this.transactionApi
      .unmarkAsTransfer(ids)
      .pipe(finalize((): void => this.unmarkingAsTransfer.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success(
            `${ids.length} transaction${ids.length === 1 ? '' : 's'} unmarked as transfer`,
          );
          this.selectedTransactions.set([]);
          this.loadTransactions();
        },
        error: (err: HttpErrorResponse): void =>
          this.toast.error(err.error?.detail || 'Failed to unmark as transfer'),
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
              this.closePanel();
              this.loadTransactions();
            },
            error: (err: unknown): void => {
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
