import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
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
import { finalize, forkJoin, Observable, of, skip, Subscription, switchMap } from 'rxjs';
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
  RuleCoverage,
} from '@models/transaction.model';
import { Account } from '@models/account.model';
import { Category, CategoryGroup } from '@models/category.model';
import {
  CategoryRuleCreateRequest,
  CategoryRuleUpdateRequest,
  RuleDraft,
  CategoryRuleApplyResult,
  RuleApplicationUndoResult,
  CreateBothAndApplyResult,
} from '@models/category-rule.model';
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
import { GridHighlights, NO_HIGHLIGHTS } from './utils/grid-highlights';
import { sharedKeyword, trimmedKeyword } from './utils/rule-keyword';
import { MerchantRuleEditFormComponent } from '@features/settings/merchant-rules/components/merchant-rule-edit-form/merchant-rule-edit-form.component';
import { MerchantRuleApiService } from '@features/settings/merchant-rules/merchant-rule-api.service';
import {
  merchantMatchConfig,
  RuleMatchConfig,
} from '@features/settings/category-rules/components/rule-match-list/rule-match-config';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import {
  MerchantRuleApplyResult,
  MerchantRuleApplyRule,
  MerchantRuleCreateRequest,
  MerchantRuleDraft,
  MerchantRuleNewMerchantRequest,
  MerchantRuleUpdateRequest,
} from '@models/merchant-rule.model';
import { RuleKind } from './utils/rule-kind';
import { NEW_MERCHANT_ID } from '@features/settings/merchant-rules/utils/merchant-options';
import { MerchantPickerComponent } from './components/merchant-picker/merchant-picker.component';
import { RuleKindChooserComponent } from './components/rule-kind-chooser/rule-kind-chooser.component';
import { RuleApplicationApiService } from './services/rule-application-api.service';
import { UndoToastComponent } from './components/undo-toast/undo-toast.component';
import { TransactionGridToolbarComponent } from './components/transaction-grid-toolbar/transaction-grid-toolbar.component';
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
import { CategoryRuleApiService } from '@features/settings/category-rules/services/category-rule-api.service';
import {
  RuleCreateValue,
  RuleEditFormComponent,
} from '@features/settings/category-rules/components/rule-edit-form/rule-edit-form.component';
import { RuleMatchListComponent } from '@features/settings/category-rules/components/rule-match-list/rule-match-list.component';

/** What the side panel is showing. */
export type TransactionPanelMode = 'closed' | 'single' | 'create' | 'bulk' | 'rule';

/** One start of the Create rule form: what it is prefilled with and which rows it shows as context. */
interface RuleStart {
  /** Changes on every start, so the form is created afresh (its keyword prefill applies only then). */
  key: number;
  keyword: string;
  context: Transaction[];
}

/**
 * Component for managing and auditing the master transaction ledger.
 *
 * Provides high-fidelity filtering, bulk operations, CSV imports, and
 * intelligent transfer matching.
 */
/** The Undo toast's offer after a rule was applied (PF-928). */
interface UndoOffer {
  message: string;
  /** the category create-and-apply result to send back, when a category rule was applied */
  category?: CategoryRuleApplyResult;
  /** the merchant create-and-apply result to send back, when a merchant rule was applied */
  merchant?: MerchantRuleApplyResult;
}

const NO_ROWS_CHANGED = 'Rule added, no transactions changed';

/** How many merchants the merchant rule form loads (the same cap as Settings). */
const RULE_MERCHANT_PAGE_SIZE = 2000;

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
    TransactionGridToolbarComponent,
    UndoToastComponent,
    RuleKindChooserComponent,
    MerchantPickerComponent,
    MerchantRuleEditFormComponent,
    SidePanelComponent,
    TransactionEditFormComponent,
    TransactionBulkFormComponent,
    ScreenToolbarComponent,
    CsvImportDialogComponent,
    TransferMatchingDialogComponent,
    PageErrorStateComponent,
    RuleEditFormComponent,
    RuleMatchListComponent,
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
  private readonly ruleApplicationApi: RuleApplicationApiService =
    inject(RuleApplicationApiService);
  private readonly merchantRuleApi: MerchantRuleApiService = inject(MerchantRuleApiService);
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>);
  private readonly ruleApi: CategoryRuleApiService = inject(CategoryRuleApiService);

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

  /**
   * What the docked side panel is showing: closed, one transaction, a new one, a bulk edit, or a new
   * category rule started from the page.
   */
  readonly panelMode: WritableSignal<TransactionPanelMode> = signal('closed');

  /** The current Create rule start (null outside rule mode). */
  readonly ruleStart: WritableSignal<RuleStart | null> = signal<RuleStart | null>(null);

  /** The rule form's draft, for the match list under it. */
  readonly ruleDraft: WritableSignal<RuleDraft | null> = signal<RuleDraft | null>(null);

  /** The Undo toast's offer after a rule was applied: its message and the result to send back (PF-928). */
  readonly undoOffer: WritableSignal<UndoOffer | null> = signal<UndoOffer | null>(null);
  readonly undoMessage: Signal<string | null> = computed(
    (): string | null => this.undoOffer()?.message ?? null,
  );
  private readonly undoing: WritableSignal<boolean> = signal(false);

  /** Which kind of rule the panel is making (PF-931); every new rule starts as a category rule. */
  readonly ruleKind: WritableSignal<RuleKind> = signal<RuleKind>('category');

  /** The kinds the chooser offers. */
  readonly ruleKindOptions: RuleKind[] = ['category', 'merchant', 'both'];

  /** Every merchant, for the merchant rule form; loaded once, the first time it is needed. */
  readonly ruleMerchants: WritableSignal<Merchant[]> = signal<Merchant[]>([]);
  private ruleMerchantsRequested = false;

  /** The merchant chosen in "Both" mode (PF-934); the "Create" option stands for a new merchant. */
  readonly bothMerchant: WritableSignal<Merchant | null> = signal<Merchant | null>(null);

  /** The ticked matches for the merchant half of a "Both" rule; the category half uses `ruleApplyIds`. */
  readonly merchantApplyIds: WritableSignal<number[]> = signal<number[]>([]);

  /** Shown under the merchant field in "Both" mode when saving without a merchant. */
  readonly bothMerchantError: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * The merchant half's draft in "Both" mode: the shared keyword form's draft plus the chosen
   * merchant, which the merchant preview needs (a new merchant has no id yet).
   */
  readonly bothMerchantDraft: Signal<MerchantRuleDraft | null> = computed(
    (): MerchantRuleDraft | null => {
      const draft: RuleDraft | null = this.ruleDraft();
      const merchant: Merchant | null = this.bothMerchant();
      if (!draft) return null;
      return {
        ...draft,
        merchantId: merchant && merchant.id !== NEW_MERCHANT_ID ? merchant.id : null,
      };
    },
  );

  /** How the match list previews and words a merchant rule (the category config is the default). */
  readonly merchantConfig: RuleMatchConfig = merchantMatchConfig(this.merchantRuleApi);

  /** The matches the owner has ticked in the rule panel's preview, to apply the rule to (PF-926). */
  readonly ruleApplyIds: WritableSignal<number[]> = signal<number[]>([]);

  /** The name of the category the rule form has chosen, for the preview's "becomes" line. */
  readonly ruleBecomes: WritableSignal<string | null> = signal<string | null>(null);

  /** The rule panel's save button, saying how many rows saving will change. */
  readonly ruleSaveLabel: Signal<string> = computed((): string => {
    // in "Both" mode a transaction ticked for both kinds is still one transaction
    const count: number =
      this.ruleKind() === 'both'
        ? new Set([...this.ruleApplyIds(), ...this.merchantApplyIds()]).size
        : this.ruleApplyIds().length;
    if (count === 0) return 'Add rule, no transactions changed';
    return `Add rule and update ${count} ${count === 1 ? 'transaction' : 'transactions'}`;
  });

  /** Categories grouped under their parents, for the rule form; loaded on the first Create rule. */
  readonly ruleGroups: WritableSignal<CategoryGroup[]> = signal<CategoryGroup[]>([]);

  /** Indicates if a new rule is being saved. */
  readonly savingRule: WritableSignal<boolean> = signal(false);

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
  /** The toolbar's row highlights (PF-924), kept only for the visit. */
  readonly highlights: WritableSignal<GridHighlights> = signal<GridHighlights>(NO_HIGHLIGHTS);

  /** Which saved rules already cover each row of the page, by transaction id (PF-925). */
  readonly ruleCoverage: WritableSignal<ReadonlyMap<number, RuleCoverage>> = signal<
    ReadonlyMap<number, RuleCoverage>
  >(new Map());

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
      case 'rule':
        return 'Create rule';
      default: {
        const transaction: Transaction | null = this.selectedTransaction();
        const name: string | undefined = transaction?.merchant?.name || transaction?.description;
        return name ? `Edit ${name}` : 'Edit transaction';
      }
    }
  });

  private readonly dashboardApi: DashboardApiService = inject(DashboardApiService);
  private readonly editForm: Signal<TransactionEditFormComponent | undefined> =
    viewChild<TransactionEditFormComponent>('editForm');
  private readonly bulkForm: Signal<TransactionBulkFormComponent | undefined> =
    viewChild<TransactionBulkFormComponent>('bulkForm');
  private readonly ruleForm: Signal<RuleEditFormComponent | undefined> =
    viewChild<RuleEditFormComponent>('ruleForm');
  private readonly merchantRuleForm: Signal<MerchantRuleEditFormComponent | undefined> =
    viewChild<MerchantRuleEditFormComponent>('merchantRuleForm');

  /** The list request in flight, cancelled when a newer load starts. */
  private listRequest: Subscription | null = null;
  private coverageRequest: Subscription | null = null;

  private ruleSessions = 0;
  private ruleGroupsRequested = false;
  /** The control that started the rule form, to hand focus back to when it closes. */
  private ruleOpener: HTMLElement | null = null;

  /** Whether the visible panel form can be saved. */
  readonly panelValid: Signal<boolean> = computed((): boolean => {
    if (this.panelMode() === 'bulk') return this.bulkForm()?.valid() ?? false;
    // an incomplete single form keeps Save enabled: clicking it shows what needs fixing, which a
    // disabled button never can
    return true;
  });

  constructor() {
    /**
     * Keeps the "rule covers it" answer in step with the rows on the page (PF-925): asks once for
     * the page's ids whenever the rows change while the highlight is on, and not at all while it is
     * off.
     */
    effect((): void => {
      const rows: Transaction[] = this.transactions();
      const on: boolean = this.highlights().ruleCovers;
      untracked((): void => this.loadRuleCoverage(on ? rows : []));
    });

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
   * Loads which saved rules cover the given rows, one call for the whole page. The newest request
   * wins: cancelling the one still in flight means a slow earlier answer can never replace a newer
   * one (the PF-910 approach). No rows, or the highlight off, clears the marks without a request.
   */
  private loadRuleCoverage(rows: Transaction[]): void {
    this.coverageRequest?.unsubscribe();
    this.coverageRequest = null;
    if (rows.length === 0) {
      this.ruleCoverage.set(new Map());
      return;
    }
    this.coverageRequest = this.transactionApi
      .getRuleCoverage(rows.map((t: Transaction): number => t.id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coverage: RuleCoverage[]): void =>
          this.ruleCoverage.set(
            new Map(
              coverage.map((c: RuleCoverage): [number, RuleCoverage] => [c.transactionId, c]),
            ),
          ),
        // marks are a hint, so a failed answer just shows none instead of failing the page
        error: (): void => this.ruleCoverage.set(new Map()),
      });
  }

  /** Asks again for the current rows, for after a rule changes what the rules cover. */
  private refreshRuleCoverage(): void {
    this.loadRuleCoverage(this.highlights().ruleCovers ? this.transactions() : []);
  }

  /**
   * Fetches the transaction dataset from the API based on current state.
   */
  loadTransactions(): void {
    // the newest request wins: cancel the one still in flight so its late (or failed) response can
    // never overwrite the list, clear the selection or drop the loading flag. This runs before
    // loading is set, because cancelling fires the old request's finalize
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(false);
    this.loadReviewCounts();
    const { filter, page, size, sort } = this.state();

    this.listRequest = this.transactionApi
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

  /** Keeps the ids ticked in the merchant preview of "Both" mode (PF-934). */
  onMerchantSelection(ids: number[]): void {
    this.merchantApplyIds.set(ids);
  }

  /** Keeps the ids of the matches ticked in the rule panel's preview. */
  onRuleSelection(ids: number[]): void {
    this.ruleApplyIds.set(ids);
  }

  /** Applies the toolbar's new highlights. */
  onHighlightsChange(highlights: GridHighlights): void {
    this.highlights.set(highlights);
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
      this.confirmDiscardIfDirty((): void => {
        this.clearRuleState();
        this.panelMode.set('bulk');
      });
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
    const mode: TransactionPanelMode = this.panelMode();
    const editing: boolean = mode === 'single' || mode === 'create';
    const dirty: boolean =
      (editing && !!this.editForm()?.form.dirty) ||
      (mode === 'rule' && !!this.activeRuleForm()?.form.dirty);
    if (!dirty) {
      proceed();
      return;
    }
    // the dialog takes focus and drops it when it closes: keeping on goes back to where it was
    const focused: HTMLElement | null = document.activeElement as HTMLElement | null;
    this.confirmationService.confirm({
      header: 'Discard changes?',
      message: `You have unsaved changes to this ${mode === 'rule' ? 'rule' : 'transaction'}. Discard them?`,
      acceptLabel: 'Discard',
      rejectLabel: 'Keep editing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: proceed,
      reject: (): void => this.refocus(focused),
    });
  }

  /** Focuses the element after the next render, if it is still on the page. */
  private refocus(target: HTMLElement | null): void {
    if (!target || target === document.body) return;
    afterNextRender(
      { read: (): void => (target.isConnected ? target.focus() : undefined) },
      { injector: this.injector },
    );
  }

  /** Opens the panel on the row whose "Choose category" pill was clicked. */
  onPickCategory(txn: Transaction): void {
    this.openEditDialog(txn);
  }

  /** Closes the side panel; a closing rule form hands focus back to the control that started it. */
  closePanel(): void {
    const wasRule: boolean = this.panelMode() === 'rule';
    this.panelMode.set('closed');
    this.selectedTransaction.set(null);
    const opener: HTMLElement | null = this.ruleOpener;
    this.clearRuleState();
    if (!wasRule) return;
    // runs after the panel's own hand-back, which only knows what had focus when it first opened.
    // The bulk bar hides while the panel is open, so a rule it started returns to its new Create
    // rule button, else to the first selected row.
    afterNextRender(
      {
        read: (): void => {
          const page: HTMLElement = this.host.nativeElement;
          const target: HTMLElement | null | undefined = opener?.isConnected
            ? opener
            : (page.querySelector<HTMLElement>('[data-testid="bulk-create-rule"]') ??
              this.firstVisible(
                page,
                '[data-testid="row-checkbox"]:checked, [data-testid="card-row-checkbox"]:checked',
              ));
          target?.focus();
        },
      },
      { injector: this.injector },
    );
  }

  /** First match that is actually shown: the list renders a table and cards, one is hidden. */
  private firstVisible(root: HTMLElement, selector: string): HTMLElement | null {
    return (
      Array.from(root.querySelectorAll<HTMLElement>(selector)).find((el: HTMLElement): boolean =>
        el.checkVisibility(),
      ) ?? null
    );
  }

  /** Saves whichever form the panel is showing. */
  onPanelSave(): void {
    switch (this.panelMode()) {
      case 'bulk':
        this.bulkForm()?.submit();
        break;
      case 'rule':
        this.activeRuleForm()?.submit();
        break;
      default:
        this.editForm()?.submit();
    }
  }

  /** Starts a rule from the transaction open in the edit panel, its trimmed description as the keyword. */
  onCreateRuleFromEditForm(): void {
    const txn: Transaction | null = this.selectedTransaction();
    if (txn) this.openRuleForm(trimmedKeyword(txn.description), []);
  }

  /**
   * Starts one rule for the selection. One selected row starts from that transaction (its
   * description trimmed of store numbers and locations, PF-929); several start from the words all
   * their descriptions share (PF-930), or with an empty keyword, showing the rows as context, when
   * they share nothing useful.
   */
  onCreateRuleFromSelection(): void {
    const rows: Transaction[] = this.selectedTransactions();
    if (rows.length === 1) {
      this.openRuleForm(trimmedKeyword(rows[0].description), []);
    } else {
      this.openRuleForm(sharedKeyword(rows.map((t: Transaction): string => t.description)), rows);
    }
  }

  /** The rule form the panel is showing: the merchant form for a merchant rule, otherwise the category form. */
  private activeRuleForm(): RuleEditFormComponent | MerchantRuleEditFormComponent | undefined {
    return this.ruleKind() === 'merchant' ? this.merchantRuleForm() : this.ruleForm();
  }

  /**
   * Switches the rule panel between a category rule and a merchant rule (PF-931), keeping the
   * keywords typed so far. Unsaved changes ask first, like closing the panel does. The new form
   * starts fresh, so the preview, the ticks and the "becomes" name start over.
   */
  onRuleKindChange(kind: RuleKind): void {
    if (kind === this.ruleKind()) return;
    this.confirmDiscardIfDirty((): void => {
      const keyword: string =
        this.activeRuleForm()?.form.controls.keywordsInput.value ?? this.ruleStart()?.keyword ?? '';
      this.ruleKind.set(kind);
      if (kind !== 'category') this.loadRuleMerchants();
      this.ruleDraft.set(null);
      this.ruleApplyIds.set([]);
      this.merchantApplyIds.set([]);
      this.bothMerchant.set(null);
      this.bothMerchantError.set(null);
      this.ruleBecomes.set(null);
      this.ruleStart.set({
        key: ++this.ruleSessions,
        keyword,
        context: this.ruleStart()?.context ?? [],
      });
      afterNextRender(
        { read: (): void => this.activeRuleForm()?.focusKeywords() },
        { injector: this.injector },
      );
    });
  }

  /** Loads every merchant for the merchant rule form, once. */
  private loadRuleMerchants(): void {
    if (this.ruleMerchantsRequested) return;
    this.ruleMerchantsRequested = true;
    this.merchantApi
      .getMerchants(null, { page: 0, size: RULE_MERCHANT_PAGE_SIZE, sort: 'name' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page: PageResponse<Merchant>): void => this.ruleMerchants.set(page.content),
        error: (err: unknown): void => {
          console.error('Failed to load merchants:', err);
          this.ruleMerchantsRequested = false;
          this.toast.error('Failed to load merchants.');
        },
      });
  }

  /**
   * Saves a merchant rule: with matches ticked in the preview (PF-932) it creates the rule and
   * applies it to exactly those rows, like a category rule; with nothing ticked it stores the rule
   * only (PF-931). A failure leaves the panel open with the form as typed.
   */
  onSaveMerchantRule(
    value: MerchantRuleCreateRequest | MerchantRuleUpdateRequest | MerchantRuleNewMerchantRequest,
  ): void {
    if (this.savingRule() || 'id' in value) return;
    const ids: number[] = this.ruleApplyIds();
    this.savingRule.set(true);

    // a merchant that does not exist yet is created by the server together with the rule (PF-933),
    // in one all-or-nothing step, so even with nothing ticked this goes through create-and-apply
    if ('newMerchantName' in value) {
      const { newMerchantName, ...rest } = value;
      this.applyMerchantRule({ ...rest, newMerchantName }, ids);
      return;
    }
    if (ids.length === 0) {
      this.merchantRuleApi
        .createRule(value)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize((): void => this.savingRule.set(false)),
        )
        .subscribe({
          next: (): void => {
            this.merchantRuleForm()?.form.markAsPristine();
            this.toast.success(NO_ROWS_CHANGED);
            this.refreshRuleCoverage();
            this.closePanel();
          },
          error: (err: HttpErrorResponse): void => this.onRuleSaveFailed(err),
        });
      return;
    }
    this.applyMerchantRule(value, ids);
  }

  /** Creates a merchant rule (and a new merchant if it is named) and applies it to the ticked rows. */
  private applyMerchantRule(rule: MerchantRuleApplyRule, transactionIds: number[]): void {
    const createsMerchant = !!rule.newMerchantName;
    this.merchantRuleApi
      .createAndApply({ rule, transactionIds })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.savingRule.set(false)),
      )
      .subscribe({
        next: (result: MerchantRuleApplyResult): void => {
          // the new merchant is not in the loaded list yet: load the list again next time it is needed
          if (createsMerchant) this.ruleMerchantsRequested = false;
          this.onMerchantRuleApplied(result);
        },
        error: (err: HttpErrorResponse): void => this.onRuleSaveFailed(err),
      });
  }

  /** Forgets the rule form's start, draft and opener, whenever the panel leaves rule mode. */
  private clearRuleState(): void {
    this.ruleStart.set(null);
    this.ruleDraft.set(null);
    this.ruleApplyIds.set([]);
    this.merchantApplyIds.set([]);
    this.bothMerchant.set(null);
    this.bothMerchantError.set(null);
    this.ruleBecomes.set(null);
    this.ruleKind.set('category');
    this.ruleOpener = null;
  }

  /**
   * Opens the panel on a fresh Create rule form, leaving the page's selection, filters and list
   * alone. Focus moves to the keyword field. The keyword comes from {@link trimmedKeyword} or
   * {@link sharedKeyword}, so it is already one comma-free part (the form reads commas as separate
   * keywords).
   */
  private openRuleForm(keyword: string, context: Transaction[]): void {
    // captured before any discard prompt takes focus
    const opener: HTMLElement | null = document.activeElement as HTMLElement | null;
    this.confirmDiscardIfDirty((): void => {
      this.loadRuleGroups();
      this.ruleOpener = opener && opener !== document.body ? opener : null;
      this.selectedTransaction.set(null);
      this.ruleDraft.set(null);
      this.ruleApplyIds.set([]);
      this.merchantApplyIds.set([]);
      this.bothMerchant.set(null);
      this.bothMerchantError.set(null);
      this.ruleBecomes.set(null);
      this.ruleKind.set('category');
      this.ruleStart.set({ key: ++this.ruleSessions, keyword, context });
      this.panelMode.set('rule');
      // the read phase runs after the panel's own move of focus to itself on opening
      afterNextRender(
        { read: (): void => this.ruleForm()?.focusKeywords() },
        { injector: this.injector },
      );
    });
  }

  /** Loads the grouped categories the rule form chooses from, once. */
  private loadRuleGroups(): void {
    if (this.ruleGroupsRequested) return;
    this.ruleGroupsRequested = true;
    this.categoryApi
      .getGroupedCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (groups: CategoryGroup[]): void => this.ruleGroups.set(groups),
        error: (err: unknown): void => {
          console.error('Failed to load categories:', err);
          this.ruleGroupsRequested = false;
          this.toast.error('Failed to load categories.');
        },
      });
  }

  /**
   * Saves the rule. With matches ticked in the preview (PF-927) it creates the rule and applies it
   * to exactly those rows in one all-or-nothing call, then closes the panel, refreshes the list (the
   * page, filters and sort stay as they are) and offers Undo. With nothing ticked it only stores the
   * rule. Either way a failure leaves the panel open with the form as typed and nothing changed.
   */
  onSaveRule(value: RuleCreateValue | CategoryRuleUpdateRequest): void {
    if (this.savingRule() || 'id' in value) return;
    const rule: CategoryRuleCreateRequest = value as CategoryRuleCreateRequest;
    if (this.ruleKind() === 'both') {
      this.saveBoth(rule);
      return;
    }
    const ids: number[] = this.ruleApplyIds();
    this.savingRule.set(true);

    if (ids.length === 0) {
      this.ruleApi
        .createRule(rule)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize((): void => this.savingRule.set(false)),
        )
        .subscribe({
          next: (): void => {
            this.ruleForm()?.form.markAsPristine();
            this.toast.success(NO_ROWS_CHANGED);
            this.refreshRuleCoverage();
            this.closePanel();
          },
          error: (err: HttpErrorResponse): void => this.onRuleSaveFailed(err),
        });
      return;
    }

    this.ruleApi
      .createAndApply({ rule, transactionIds: ids })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.savingRule.set(false)),
      )
      .subscribe({
        next: (result: CategoryRuleApplyResult): void => this.onRuleApplied(result),
        error: (err: HttpErrorResponse): void => this.onRuleSaveFailed(err),
      });
  }

  /**
   * Saves a category rule and a merchant rule together (PF-934), from the shared keyword form and
   * the merchant field: one all-or-nothing call, each kind applied to its own ticked rows. Without
   * a merchant it asks for one and saves nothing. A failure leaves the panel open as typed.
   */
  private saveBoth(category: CategoryRuleCreateRequest): void {
    const merchant: Merchant | null = this.bothMerchant();
    if (!merchant) {
      this.bothMerchantError.set('Choose a merchant.');
      return;
    }
    this.bothMerchantError.set(null);
    const shared = {
      keywords: category.keywords,
      matchType: category.matchType,
      priority: category.priority,
      minAmount: category.minAmount,
      maxAmount: category.maxAmount,
    };
    const merchantRule: MerchantRuleApplyRule =
      merchant.id === NEW_MERCHANT_ID
        ? { ...shared, newMerchantName: merchant.name }
        : { ...shared, merchantId: merchant.id };
    this.savingRule.set(true);
    this.ruleApplicationApi
      .createBothAndApply({
        category: { rule: category, transactionIds: this.ruleApplyIds() },
        merchant: { rule: merchantRule, transactionIds: this.merchantApplyIds() },
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.savingRule.set(false)),
      )
      .subscribe({
        next: (result: CreateBothAndApplyResult): void => {
          if (merchant.id === NEW_MERCHANT_ID) this.ruleMerchantsRequested = false;
          this.onBothApplied(result);
        },
        error: (err: HttpErrorResponse): void => this.onRuleSaveFailed(err),
      });
  }

  /** After both rules were created and applied: one Undo for both, naming both kinds and their counts. */
  private onBothApplied(result: CreateBothAndApplyResult): void {
    const categorized: number = result.category.changes.length;
    const merchants: number = result.merchant.changes.length;
    this.afterRuleApplied(
      categorized + merchants,
      { category: result.category, merchant: result.merchant },
      `Rules added. ${categorized} ${categorized === 1 ? 'transaction' : 'transactions'} categorized, ${merchants} given a merchant.`,
      'Rules added, no transactions changed',
    );
  }

  /** Shows why saving the rule failed, in the form, which stays open as the owner typed it. */
  private onRuleSaveFailed(err: HttpErrorResponse): void {
    console.error('Saving the rule failed:', err);
    this.activeRuleForm()?.errorMessage.set(err.error?.detail || 'Failed to save the rule.');
  }

  /** After a category rule was created and applied: close the panel, refresh the list and offer Undo. */
  private onRuleApplied(result: CategoryRuleApplyResult): void {
    this.afterRuleApplied(result.changes.length, { category: result });
  }

  /** After a merchant rule was created and applied: close the panel, refresh the list and offer Undo. */
  private onMerchantRuleApplied(result: MerchantRuleApplyResult): void {
    this.afterRuleApplied(result.changes.length, { merchant: result });
  }

  /**
   * The same ending for every kind of rule (PF-927, PF-932): with rows changed, offer Undo with the
   * count; with none, just say so. Then close the panel and refresh the list.
   */
  private afterRuleApplied(
    changed: number,
    offer: Omit<UndoOffer, 'message'>,
    message?: string,
    nothingChanged: string = NO_ROWS_CHANGED,
  ): void {
    this.activeRuleForm()?.form.markAsPristine();
    if (changed === 0) {
      this.undoOffer.set(null);
      this.toast.success(nothingChanged);
    } else {
      this.undoOffer.set({
        message:
          message ??
          `Rule added. ${changed} ${changed === 1 ? 'transaction' : 'transactions'} updated.`,
        ...offer,
      });
    }
    this.closePanel();
    this.loadTransactions();
  }

  /**
   * Undoes the rule that was just applied: sends the apply result back, which restores the changed
   * rows (leaving any that changed since alone) and deletes the rule, then refreshes the list.
   */
  undoLastApply(): void {
    const offer: UndoOffer | null = this.undoOffer();
    if (!offer || this.undoing()) return;
    this.undoing.set(true);
    this.ruleApplicationApi
      .undo({
        ...(offer.category ? { category: offer.category } : {}),
        ...(offer.merchant ? { merchant: offer.merchant } : {}),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.undoing.set(false)),
      )
      .subscribe({
        next: (undone: RuleApplicationUndoResult): void => {
          this.undoOffer.set(null);
          this.loadTransactions();
          const left: number = undone.skippedTransactionIds.length;
          const restored = `${undone.restoredCount} ${undone.restoredCount === 1 ? 'transaction' : 'transactions'} restored`;
          this.toast.success(
            left > 0
              ? `Rule undone. ${restored}; ${left} changed since and ${left === 1 ? 'was' : 'were'} left alone.`
              : `Rule undone. ${restored}.`,
          );
        },
        error: (): void => {
          this.undoOffer.set(null);
          this.toast.error('Could not undo the rule. Nothing was changed.');
        },
      });
  }

  /** Drops the Undo offer without undoing anything. */
  dismissUndo(): void {
    this.undoOffer.set(null);
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
      this.clearRuleState();
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
      this.clearRuleState();
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
   * Reloads the list once an import has saved transactions. The import dialog stays open on its
   * Result step; the transfer review is offered there, not opened here (PF-898).
   */
  onImportComplete(): void {
    this.loadTransactions();
  }

  /**
   * Opens the transfer review the user asked for from the import's Result step. The import dialog
   * has already closed by then, so focus returns to the page before this dialog takes it.
   */
  onImportReviewTransfers(): void {
    this.showTransferDialog.set(true);
  }
}
