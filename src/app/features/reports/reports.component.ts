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
  signal,
  Signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { catchError, finalize, forkJoin, Observable, of, Subscription } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { Account } from '@models/account.model';
import { Category } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { Tag } from '@models/tag.model';
import { PageResponse } from '@models/transaction.model';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { TagApiService } from '@features/tags/services/tag-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { downloadCsv, toCsv } from '@shared/utils/csv.utils';
import { DateRangeFilterComponent } from './components/date-range-filter/date-range-filter.component';
import { DrillBreadcrumbComponent } from './components/drill-breadcrumb/drill-breadcrumb.component';
import { ExplorerControlsComponent } from './components/explorer-controls/explorer-controls.component';
import { FilterBarComponent } from './components/filter-bar/filter-bar.component';
import { NetWorthReportComponent } from './components/net-worth-report/net-worth-report.component';
import { ResultsTableComponent } from './components/results-table/results-table.component';
import { SummaryCardsComponent } from './components/summary-cards/summary-cards.component';
import { TransactionListComponent } from './components/transaction-list/transaction-list.component';
import { TrendChartComponent } from './components/trend-chart/trend-chart.component';
import {
  DateRange,
  ExploreFilters,
  ExploreResult,
  ExploreRow,
  ExploreState,
  ExploreTransaction,
  ExploreTrend,
  SortKey,
  TrendBucket,
} from './models/reports.model';
import { ReportApiService } from './services/report-api.service';
import {
  biggestRow,
  bucketLabel,
  changeText,
  drill,
  filterOnly,
  GROUP_LABELS,
  Granularity,
  hydrateState,
  granularityOf,
  isAllowed,
  isTransactionsLinkable,
  MEASURE_LABELS,
  openTransactions,
  rangeText,
  reconcileDrill,
  rootCrumb,
  selectPeriod,
  stepBack,
  toTransactionsQuery,
} from './utils/explore-helpers';
import { defaultState, effectiveDates, TIME_GROUPINGS, toQueryParams } from './utils/explore-state';

const LOOKUP_PAGE_SIZE = 20;
const LEAF_PAGE_SIZE = 20;

type View = 'explorer' | 'networth';

/**
 * The Reports page: a drill-down explorer over the user's income and spending (measure x grouping x
 * stacked filters, comparison, trend, transactions at the bottom) and, until it is rebuilt, the old Net
 * worth chart. Owns the one explorer state, mirrors it to the URL both ways, and reloads whenever it
 * changes; every child is presentational.
 */
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    SkeletonModule,
    ScreenToolbarComponent,
    PageErrorStateComponent,
    DateRangeFilterComponent,
    DrillBreadcrumbComponent,
    ExplorerControlsComponent,
    FilterBarComponent,
    NetWorthReportComponent,
    ResultsTableComponent,
    SummaryCardsComponent,
    TransactionListComponent,
    TrendChartComponent,
  ],
  templateUrl: './reports.component.html',
  host: { '(document:keydown.escape)': 'onEscape($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly api: ReportApiService = inject(ReportApiService);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);
  private readonly toast: ToastService = inject(ToastService);
  private readonly accountApi: AccountApiService = inject(AccountApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly tagApi: TagApiService = inject(TagApiService);
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);

  readonly state: WritableSignal<ExploreState> = signal(defaultState());
  readonly view: WritableSignal<View> = signal('explorer');
  readonly result: WritableSignal<ExploreResult | null> = signal(null);
  readonly trend: WritableSignal<ExploreTrend | null> = signal(null);
  readonly leafPage: WritableSignal<PageResponse<ExploreTransaction> | null> = signal(null);
  /** The trend, or the page of transactions, failed to load though the groups did. */
  readonly trendFailed: WritableSignal<boolean> = signal(false);
  readonly leafFailed: WritableSignal<boolean> = signal(false);
  readonly leafIndex: WritableSignal<number> = signal(0);
  readonly loading: WritableSignal<boolean> = signal(false);
  readonly loadError: WritableSignal<boolean> = signal(false);
  /** First-load skeleton only; after that results stay visible (dimmed) while re-querying. */
  readonly loadedOnce: WritableSignal<boolean> = signal(false);
  /** Why the URL's settings were replaced by defaults, shown until the next change. */
  readonly note: WritableSignal<string | null> = signal(null);
  /** What a screen reader hears after a drill. */
  readonly announcement: WritableSignal<string> = signal('');
  readonly search: WritableSignal<string> = signal('');
  readonly expandedOther: WritableSignal<boolean> = signal(false);
  readonly controlsOpen: WritableSignal<boolean> = signal(false);

  readonly accounts: WritableSignal<Account[]> = signal([]);
  readonly categories: WritableSignal<Category[]> = signal([]);
  readonly tags: WritableSignal<Tag[]> = signal([]);
  readonly merchants: WritableSignal<Merchant[]> = signal([]);
  /**
   * Merchants whose name matches the merchant being filtered on, looked up for that name alone, so
   * the ambiguity check sees every similar name and not only the ones in the filter's list. Null
   * until answered.
   */
  private readonly similarMerchants: WritableSignal<Merchant[] | null> = signal(null);

  private readonly heading: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild<ElementRef<HTMLElement>>('heading');
  private loadSubscription: Subscription | null = null;
  private merchantSubscription: Subscription | null = null;
  private similarSubscription: Subscription | null = null;
  private loadRun = 0;
  /** The URL parameters last written or read, so the URL effect doesn't echo what it just read. */
  private urlKey = '';
  /** The next URL write adds a history entry (a drill) rather than replacing the current one. */
  private pushNext = false;

  protected readonly groupLabel: Signal<string> = computed(
    (): string => GROUP_LABELS[this.state().groupBy],
  );
  protected readonly measureLabel: Signal<string> = computed(
    (): string => MEASURE_LABELS[this.state().measure],
  );
  protected readonly dateRange: Signal<DateRange> = computed((): DateRange => {
    const s: ExploreState = this.state();
    return { startDate: s.startDate, endDate: s.endDate, label: s.rangeLabel };
  });
  protected readonly rangeLine: Signal<string> = computed((): string => {
    const { startDate, endDate } = effectiveDates(this.state());
    return rangeText(startDate, endDate);
  });
  readonly crumbs: Signal<string[]> = computed((): string[] => [
    rootCrumb(this.state().measure, this.state().side),
    ...this.state().drill.map((s) => s.label),
  ]);
  protected readonly headingText: Signal<string> = computed((): string => {
    const s: ExploreState = this.state();
    const where: string = this.crumbs().at(-1) as string;
    return s.leaf
      ? `Transactions: ${where}`
      : `${this.measureLabel()} by ${this.groupLabel().toLowerCase()}${s.drill.length ? `: ${where}` : ''}`;
  });
  protected readonly hasFilters: Signal<boolean> = computed((): boolean => {
    const f: ExploreFilters = this.state().filters;
    return (
      this.state().drill.length > 0 ||
      f.accountIds.length > 0 ||
      Object.entries(f).some(
        ([key, value]) => key !== 'accountIds' && value !== undefined && value !== false,
      )
    );
  });
  protected readonly emptyText: Signal<string> = computed((): string => {
    switch (this.state().measure) {
      case 'SPENDING':
        return 'No spending in this period';
      case 'INCOME':
        return 'No income in this period';
      default:
        return 'Nothing to show for this period';
    }
  });
  protected readonly biggest: Signal<ExploreRow | null> = computed((): ExploreRow | null =>
    biggestRow(this.result()?.rows ?? [], this.state().compare),
  );
  /**
   * Whether the Transactions page can show the same transactions. Beyond the filters it can't express,
   * it matches category and merchant names loosely (a substring), so a parent category, or a name
   * contained in another's, would open a different set than the one behind the number.
   */
  protected readonly linkable: Signal<{ ok: boolean; reason?: string }> = computed(() => {
    const base = isTransactionsLinkable(this.state().filters, this.state().measure);
    if (!base.ok) return base;
    const f: ExploreFilters = this.state().filters;
    const no = (reason: string): { ok: boolean; reason: string } => ({
      ok: false,
      reason: `The Transactions page can't ${reason}.`,
    });
    const contains = (names: string[], name: string | undefined): boolean =>
      !!name && names.some((other: string) => other.toLowerCase().includes(name.toLowerCase()));
    if (f.categoryId !== undefined) {
      const categories: Category[] = this.categories();
      if (categories.some((c: Category) => c.parent?.id === f.categoryId)) {
        return no('open a whole category group, only a single subcategory');
      }
      const others: string[] = categories
        .filter((c: Category) => c.id !== f.categoryId)
        .map((c) => c.name);
      if (contains(others, f.categoryName))
        return no('tell this category apart from others with similar names');
    }
    if (f.merchantId !== undefined) {
      const others: string[] = (this.similarMerchants() ?? this.merchants())
        .filter((m: Merchant) => m.id !== f.merchantId)
        .map((m: Merchant) => m.name);
      if (contains(others, f.merchantName))
        return no('tell this merchant apart from others with similar names');
    }
    return base;
  });
  protected readonly trimEmptyTrend: Signal<boolean> = computed(
    (): boolean => this.state().rangeLabel === 'All time',
  );

  /** The CSV: a title line, a filters line, then every row (not only the top ten). */
  readonly csvRows: Signal<string[][]> = computed((): string[][] => {
    const s: ExploreState = this.state();
    const result: ExploreResult | null = this.result();
    const number = (value: number | null): string =>
      value === null ? '' : s.measure === 'COUNT' ? String(value) : value.toFixed(2);
    return [
      [`${this.measureLabel()} by ${this.groupLabel().toLowerCase()}, ${this.rangeLine()}`],
      [`Filters: ${this.filtersSummary()}`],
      [this.groupLabel(), this.measureLabel(), 'Comparison', 'Change', 'Count'],
      ...(result?.rows ?? []).map((r: ExploreRow): string[] => [
        r.label,
        number(r.value),
        number(r.comparisonValue),
        changeText(r.value, r.comparisonValue, s.measure).text.replace(/^[▲▼] /, ''),
        String(r.count),
      ]),
    ];
  });

  constructor() {
    const { state, note } = hydrateState(this.route.snapshot.queryParams);
    this.state.set(state);
    this.view.set(this.route.snapshot.queryParams['view'] === 'networth' ? 'networth' : 'explorer');
    this.leafIndex.set(this.pageFrom(this.route.snapshot.queryParams));
    this.note.set(note);
    // an invalid URL is rewritten with what was actually applied; a valid one is left alone
    this.urlKey = note ? '' : JSON.stringify(this.urlParams());

    effect((): void => {
      const params: Params = this.urlParams();
      untracked((): void => this.writeUrl(params));
    });

    effect((): void => {
      const name: string | undefined = this.state().filters.merchantName;
      untracked((): void => this.loadSimilarMerchants(name));
    });

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => this.followUrl(params));

    this.loadLookups();
    this.load();
  }

  // ---- state changes ----

  /** Merges a change from the controls, keeping the state consistent (see the notes inline). */
  onStateChange(change: Partial<ExploreState>): void {
    const previous: ExploreState = this.state();
    let next: ExploreState = { ...previous, ...change };
    const rangeChanged: boolean =
      next.startDate !== previous.startDate ||
      next.endDate !== previous.endDate ||
      next.rangeLabel !== previous.rangeLabel;
    if (rangeChanged) {
      // a drilled month or week belongs to the range it was drilled in
      next = { ...next, period: null, drill: next.drill.filter((s) => s.filterKey !== 'period') };
    }
    if (!isAllowed(next.measure, next.groupBy).ok) {
      next = { ...next, groupBy: 'MONTH' };
    }
    const wasTime: boolean = this.isTimeLike(previous.groupBy);
    const isTime: boolean = this.isTimeLike(next.groupBy);
    if (!wasTime && isTime && next.sort === 'value') next = { ...next, sort: 'name' };
    else if (wasTime && !isTime && next.sort === 'name') next = { ...next, sort: 'value' };
    this.commit(next);
  }

  /** Replaces the filters from the filter menu or a chip, dropping drill steps they no longer include. */
  onFiltersChange(filters: ExploreFilters): void {
    let next: ExploreState = reconcileDrill({ ...this.state(), filters });
    if (next.groupBy === 'SUBCATEGORY' && next.filters.categoryId === undefined) {
      next = { ...next, groupBy: 'CATEGORY' };
    }
    this.commit(next);
  }

  onDrill(row: ExploreRow): void {
    const next: ExploreState = drill(this.state(), row);
    if (next === this.state()) return;
    this.pushNext = true;
    this.announcement.set(
      next.leaf
        ? `Showing the transactions for ${row.label}`
        : `Showing ${row.label} by ${GROUP_LABELS[next.groupBy].toLowerCase()}`,
    );
    this.commit(next);
    this.focusHeading();
  }

  onFilterOnly(row: ExploreRow): void {
    const next: ExploreState = filterOnly(this.state(), row);
    if (next === this.state()) return;
    this.pushNext = true;
    this.announcement.set(`Filtered to ${row.label}`);
    this.commit(next);
  }

  onOpenTransactions(row: ExploreRow): void {
    const next: ExploreState = openTransactions(this.state(), row);
    if (next === this.state()) return;
    this.pushNext = true;
    this.announcement.set(`Showing the transactions for ${row.label}`);
    this.commit(next);
    this.focusHeading();
  }

  /** Goes back to a crumb, or removes the drill chip at that index (and everything after it). */
  onStepBack(index: number): void {
    const next: ExploreState = stepBack(this.state(), index);
    if (next === this.state()) return;
    this.pushNext = true;
    this.announcement.set(
      `Showing ${this.measureLabel().toLowerCase()} by ${GROUP_LABELS[next.groupBy].toLowerCase()}`,
    );
    this.commit(next);
    this.focusHeading();
  }

  /** Clicking a trend bar filters to its day, week or month. */
  onSelectBucket(bucket: TrendBucket): void {
    const granularity: Granularity = granularityOf(
      (this.trend()?.current ?? []).map((b) => b.start),
    );
    this.commit(
      selectPeriod(this.state(), bucket.start, granularity, bucketLabel(bucket.start, granularity)),
    );
  }

  /** Escape steps back one level, unless it is closing something or the user is typing. */
  onEscape(event: Event): void {
    const target: HTMLElement | null = event.target instanceof HTMLElement ? event.target : null;
    if (this.view() !== 'explorer' || this.state().drill.length === 0) return;
    if (
      target?.closest(
        'input, textarea, select, [role="combobox"], [role="menu"], [aria-expanded="true"]',
      )
    )
      return;
    this.onStepBack(this.state().drill.length - 1);
  }

  clearFilters(): void {
    const s: ExploreState = this.state();
    this.commit({
      ...s,
      filters: { accountIds: [] },
      drill: [],
      period: null,
      leaf: false,
      groupBy: s.groupBy === 'SUBCATEGORY' ? 'CATEGORY' : s.groupBy,
    });
  }

  onPageChange(index: number): void {
    this.leafIndex.set(index);
    this.load();
  }

  onSortChange(sort: SortKey): void {
    this.state.update((s: ExploreState) => ({ ...s, sort }));
  }

  setView(view: View): void {
    if (view === this.view()) return;
    this.view.set(view);
    if (view === 'explorer') this.load();
  }

  onNetWorthRange(range: DateRange): void {
    this.onStateChange({
      startDate: range.startDate,
      endDate: range.endDate,
      rangeLabel: range.label ?? 'Custom',
    });
  }

  /** Narrows the merchant choice as the user types in the merchant filter's search. */
  onMerchantSearch(term: string): void {
    this.loadMerchants(term.trim() || null);
  }

  retry(): void {
    this.load();
  }

  // ---- actions ----

  exportCsv(): void {
    const { startDate, endDate } = effectiveDates(this.state());
    const slug = (value: string): string => value.toLowerCase().replace(/\s+/g, '-');
    const name = `reports_${slug(this.measureLabel())}-by-${slug(this.groupLabel())}_${startDate}_to_${endDate}.csv`;
    downloadCsv(name, toCsv(this.csvRows()));
  }

  async copyLink(): Promise<void> {
    const tree = this.router.createUrlTree([], { queryParams: this.urlParams() });
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${this.router.serializeUrl(tree)}`,
      );
      this.toast.success('Link copied');
    } catch {
      this.toast.error('Could not copy the link');
    }
  }

  /** Opens the transactions behind the number on the Transactions page, with the same filters. */
  openInTransactions(): void {
    const queryParams: Params | null = this.linkable().ok
      ? toTransactionsQuery(this.state())
      : null;
    if (queryParams) {
      void this.router.navigate(['/transactions'], { queryParams });
    }
  }

  // ---- internals ----

  private isTimeLike(groupBy: ExploreState['groupBy']): boolean {
    return TIME_GROUPINGS.includes(groupBy) || groupBy === 'DAY_OF_WEEK';
  }

  private commit(next: ExploreState): void {
    this.state.set(next);
    this.leafIndex.set(0);
    this.search.set('');
    this.expandedOther.set(false);
    this.note.set(null);
    this.load();
  }

  /** Loads the groups, the trend and, at the leaf, a page of transactions; a newer load replaces an older one. */
  private load(): void {
    this.loadSubscription?.unsubscribe();
    if (this.view() !== 'explorer') return;
    const run: number = ++this.loadRun;
    const state: ExploreState = this.state();
    this.loading.set(true);
    this.loadError.set(false);

    const softFail =
      <T>(label: string): ((error: unknown) => Observable<T | null>) =>
      (error: unknown): Observable<T | null> => {
        console.error(`Failed to load ${label}:`, error);
        return of(null);
      };
    this.loadSubscription = forkJoin({
      result: this.api.explore(state),
      trend: this.api.trend(state).pipe(catchError(softFail<ExploreTrend>('the trend'))),
      leaf: state.leaf
        ? this.api
            .transactions(state, this.leafIndex(), LEAF_PAGE_SIZE)
            .pipe(catchError(softFail<PageResponse<ExploreTransaction>>('the transactions')))
        : of(null),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.loadRun) this.loading.set(false);
        }),
      )
      .subscribe({
        next: ({ result, trend, leaf }): void => {
          this.result.set(result);
          this.trend.set(trend);
          this.leafPage.set(leaf);
          // a part that failed to load comes back null; the rest of the report is still good
          this.trendFailed.set(trend === null);
          this.leafFailed.set(state.leaf && leaf === null);
          this.loadedOnce.set(true);
        },
        error: (error: unknown): void => {
          console.error('Failed to load the report:', error);
          this.result.set(null);
          this.trend.set(null);
          this.leafPage.set(null);
          this.trendFailed.set(false);
          this.leafFailed.set(false);
          this.loadError.set(true);
        },
      });
  }

  private focusHeading(): void {
    afterNextRender((): void => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }

  private pageFrom(params: Params): number {
    const page = Number(params['page']);
    return Number.isInteger(page) && page > 0 ? page : 0;
  }

  private urlParams(): Params {
    const params: Params = toQueryParams(this.state());
    if (this.view() === 'networth') params['view'] = 'networth';
    if (this.state().leaf && this.leafIndex() > 0) params['page'] = String(this.leafIndex());
    return params;
  }

  private writeUrl(params: Params): void {
    const key: string = JSON.stringify(params);
    if (key === this.urlKey) return;
    this.urlKey = key;
    const replaceUrl = !this.pushNext;
    this.pushNext = false;
    void this.router.navigate([], { queryParams: params, replaceUrl });
  }

  /** Follows the URL when it changes underneath (back and forward), ignoring what we wrote ourselves. */
  private followUrl(params: Params): void {
    const { state, note } = hydrateState(params);
    const view: View = params['view'] === 'networth' ? 'networth' : 'explorer';
    const index: number = this.pageFrom(params);
    const incoming: string = JSON.stringify({
      ...toQueryParams(state),
      ...(view === 'networth' ? { view: 'networth' } : {}),
      ...(state.leaf && index > 0 ? { page: String(index) } : {}),
    });
    if (incoming === JSON.stringify(this.urlParams())) return;
    this.urlKey = incoming;
    this.state.set(state);
    this.view.set(view);
    this.leafIndex.set(index);
    this.note.set(note);
    this.load();
  }

  private loadLookups(): void {
    const soft =
      (label: string) =>
      (error: unknown): void =>
        console.error(`Failed to load ${label} for the filters:`, error);
    this.accountApi
      .getAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Account[]): void => this.accounts.set(data),
        error: soft('accounts'),
      });
    this.categoryApi
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: Category[]): void => this.categories.set(data),
        error: soft('categories'),
      });
    this.tagApi
      .getTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (data: Tag[]): void => this.tags.set(data), error: soft('tags') });
    this.loadMerchants(null);
  }

  /** Looks up the merchants whose name contains the filtered merchant's name (see `similarMerchants`). */
  private loadSimilarMerchants(name: string | undefined): void {
    this.similarSubscription?.unsubscribe();
    this.similarMerchants.set(null);
    if (!name) return;
    this.similarSubscription = this.merchantApi
      .getMerchants(name, { page: 0, size: LOOKUP_PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: PageResponse<Merchant>): void => this.similarMerchants.set(res.content),
        error: (error: unknown): void =>
          console.error('Failed to look up similar merchants:', error),
      });
  }

  private loadMerchants(term: string | null): void {
    this.merchantSubscription?.unsubscribe();
    this.merchantSubscription = this.merchantApi
      .getMerchants(term, { page: 0, size: LOOKUP_PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: PageResponse<Merchant>): void => this.merchants.set(res.content),
        error: (error: unknown): void =>
          console.error('Failed to load merchants for the filters:', error),
      });
  }

  /** The filters in words, for the CSV's header line. */
  private filtersSummary(): string {
    const f: ExploreFilters = this.state().filters;
    const parts: string[] = [];
    if (f.accountIds.length) {
      parts.push(
        `accounts ${f.accountIds.map((id) => this.accounts().find((a) => a.id === id)?.name ?? id).join(', ')}`,
      );
    }
    if (f.categoryName) parts.push(`category ${f.categoryName}`);
    if (f.uncategorized) parts.push('uncategorized');
    if (f.merchantName) parts.push(`merchant ${f.merchantName}`);
    if (f.noMerchant) parts.push('no merchant');
    if (f.tagId !== undefined)
      parts.push(`tag ${this.tags().find((t) => t.id === f.tagId)?.name ?? f.tagId}`);
    if (f.noTag) parts.push('no tag');
    if (f.minAmount !== undefined) parts.push(`at least ${f.minAmount}`);
    if (f.maxAmount !== undefined) parts.push(`at most ${f.maxAmount}`);
    const period: string | undefined = this.state().period?.label;
    if (period) parts.push(`period ${period}`);
    return parts.length ? parts.join('; ') : 'none';
  }
}
