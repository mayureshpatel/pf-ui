import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { finalize, skip } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ProgressBarModule } from 'primeng/progressbar';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Tooltip } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';

import { Budget, BudgetStatus } from '@models/budget.model';
import { Category } from '@models/category.model';
import { MonthOption, YearOption } from '@models/dashboard.model';
import { PageResponse } from '@models/transaction.model';
import { BudgetApiService } from './services/budget-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { BudgetFormDialogComponent } from './components/budget-form-dialog/budget-form-dialog.component';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { getCategoryColor } from '@shared/utils/category.utils';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';

const ALL_BUDGETS_PAGE_SIZE = 20;

/**
 * Component for managing and tracking monthly budgets.
 *
 * Provides two view modes:
 * 1. Monthly Status: Tracks spending against budgets for a specific month/year.
 * 2. Manage All: A flat list of all defined budgets for administrative actions.
 */
@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    TableModule,
    ProgressBarModule,
    Select,
    SelectButton,
    CheckboxModule,
    ProgressSpinnerModule,
    ScreenToolbarComponent,
    BudgetFormDialogComponent,
    FormatCurrencyPipe,
    Tooltip,
    PageErrorStateComponent,
  ],
  templateUrl: './budgets.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsComponent implements OnInit {
  private readonly budgetApi: BudgetApiService = inject(BudgetApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);

  /** The list of budgets status for the selected month/year. */
  readonly budgetStatuses: WritableSignal<BudgetStatus[]> = signal([]);

  /** The current page of the "manage all" budgets list (PF-320: server-paginated -- this list
   *  grows unboundedly with how many periods a user has budgeted). */
  readonly allBudgets: WritableSignal<Budget[]> = signal([]);

  /** Total budgets across all periods, for the "manage all" paginator. */
  readonly allBudgetsTotalRecords: WritableSignal<number> = signal(0);

  /** Zero-based index of the currently displayed "manage all" page. */
  readonly allBudgetsPage: WritableSignal<number> = signal(0);

  /** Available categories for creating new budgets. */
  readonly categories: WritableSignal<Category[]> = signal([]);

  /** Global loading state for API operations. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Whether the most recent load attempt for the active view mode failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Visibility of the set-budget dialog. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** Current view mode: 'monthly' status or 'all' list. */
  readonly viewMode: WritableSignal<'monthly' | 'all'> = signal('monthly');

  /** Currently selected month (1-12). Defaults to current month. */
  readonly selectedMonth: WritableSignal<number> = signal(new Date().getMonth() + 1);

  /** Currently selected year. Defaults to current year. */
  readonly selectedYear: WritableSignal<number> = signal(new Date().getFullYear());

  /** Sum of all budgeted amounts for the selected period. */
  readonly totalBudgeted: Signal<number> = computed((): number =>
    this.budgetStatuses().reduce((acc, curr): number => acc + curr.budgetedAmount, 0),
  );

  /** Sum of all spent amounts for the selected period. */
  readonly totalSpent: Signal<number> = computed((): number =>
    this.budgetStatuses().reduce((acc, curr): number => acc + curr.spentAmount, 0),
  );

  /** Difference between total budgeted and total spent. */
  readonly totalRemaining: Signal<number> = computed(
    (): number => this.totalBudgeted() - this.totalSpent(),
  );

  /** Overall percentage of the total budget spent. */
  readonly totalSpentPercentage: Signal<number> = computed((): number => {
    const budgeted: number = this.totalBudgeted();

    if (budgeted === 0) {
      return 0;
    }
    return (this.totalSpent() / budgeted) * 100;
  });

  readonly viewOptions = [
    { label: 'Monthly Status', value: 'monthly', icon: 'pi pi-calendar' },
    { label: 'Manage All', value: 'all', icon: 'pi pi-list' },
  ];

  readonly monthOptions: MonthOption[] = [
    { label: 'January', value: 1 },
    { label: 'February', value: 2 },
    { label: 'March', value: 3 },
    { label: 'April', value: 4 },
    { label: 'May', value: 5 },
    { label: 'June', value: 6 },
    { label: 'July', value: 7 },
    { label: 'August', value: 8 },
    { label: 'September', value: 9 },
    { label: 'October', value: 10 },
    { label: 'November', value: 11 },
    { label: 'December', value: 12 },
  ];

  yearOptions: YearOption[] = [];
  getCategoryColor = getCategoryColor;

  /**
   * Initializes component data. Hydrates the month/year selection from URL query params first
   * (if present) so the initial load reflects a shared/refreshed link, then keeps it in sync with
   * later external navigation (e.g. browser back/forward).
   */
  ngOnInit(): void {
    this.hydrateFromParams(this.route.snapshot.queryParams);
    this.initializeYearOptions();
    this.loadCategories();
    this.updateUrlParams();
    this.refreshData();

    this.route.queryParams
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => {
        this.hydrateFromParams(params);
        this.refreshData();
      });
  }

  /**
   * Translates URL query params into the month/year signals, only writing when the parsed value
   * actually differs from the current one.
   */
  private hydrateFromParams(params: Params): void {
    const month: number | undefined = params['month'] ? Number(params['month']) : undefined;
    const year: number | undefined = params['year'] ? Number(params['year']) : undefined;

    if (month !== undefined && month !== this.selectedMonth()) {
      this.selectedMonth.set(month);
    }
    if (year !== undefined && year !== this.selectedYear()) {
      this.selectedYear.set(year);
    }
  }

  /**
   * Serializes the current month/year to URL query params. Always written (never omitted as a
   * "default"), since some month/year is always selected -- there's no meaningful "unset" state.
   */
  private updateUrlParams(): void {
    this.router.navigate([], {
      queryParams: { month: this.selectedMonth(), year: this.selectedYear() },
      queryParamsHandling: 'replace',
      replaceUrl: true,
    });
  }

  /**
   * Populates year options for the filter dropdown.
   */
  private initializeYearOptions(): void {
    const currentYear: number = new Date().getFullYear();
    const years: YearOption[] = [];

    for (let year = 2020; year <= currentYear + 1; year++) {
      years.push({ label: year.toString(), value: year });
    }
    this.yearOptions = years;
  }

  /**
   * Fetches all categories from the API.
   */
  private loadCategories(): void {
    this.categoryApi
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories: Category[]): void => this.categories.set(categories),
        error: (err: any): void => {
          console.error('Failed to load categories:', err);
          this.toast.error('Failed to load categories');
        },
      });
  }

  /**
   * Refreshes the budget data based on the current view mode.
   */
  refreshData(): void {
    if (this.viewMode() === 'all') {
      this.loadAllBudgets();
    } else {
      this.loadBudgetStatus();
    }
  }

  /**
   * Loads the budget status summary for the selected period.
   */
  private loadBudgetStatus(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.budgetApi
      .getBudgetStatus(this.selectedMonth(), this.selectedYear())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: (status: BudgetStatus[]): void => this.budgetStatuses.set(status),
        error: (err: any): void => {
          console.error('Failed to load budget status:', err);
          this.toast.error('Failed to load budget status');
          this.loadError.set(true);
        },
      });
  }

  /**
   * Loads the current page of the "manage all" budgets list.
   */
  private loadAllBudgets(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.budgetApi
      .getAllBudgets({ page: this.allBudgetsPage(), size: ALL_BUDGETS_PAGE_SIZE })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: (page: PageResponse<Budget>): void => {
          this.allBudgets.set(page.content);
          this.allBudgetsTotalRecords.set(page.page.totalElements);
        },
        error: (err: any): void => {
          console.error('Failed to load all budgets:', err);
          this.toast.error('Failed to load all budgets');
          this.loadError.set(true);
        },
      });
  }

  /**
   * Handles the "manage all" table's lazy-load event (page navigation).
   * @param event the PrimeNG lazy-load event carrying the new page's starting row offset.
   */
  onAllBudgetsPageChange(event: { first?: number }): void {
    this.allBudgetsPage.set(Math.floor((event.first ?? 0) / ALL_BUDGETS_PAGE_SIZE));
    this.loadAllBudgets();
  }

  /**
   * Responds to changes in the month or year filters.
   */
  onPeriodChange(): void {
    this.updateUrlParams();
    this.loadBudgetStatus();
  }

  /**
   * Responds to view mode toggle. Resets to the first "manage all" page on every fresh entry into
   * that view, rather than preserving wherever the user last scrolled to.
   */
  onToggleView(): void {
    if (this.viewMode() === 'all') {
      this.allBudgetsPage.set(0);
    }
    this.refreshData();
  }

  /**
   * Opens the budget creation dialog.
   */
  openSetBudgetDialog(): void {
    this.showDialog.set(true);
  }

  /**
   * Callback for when a budget is saved successfully in the child dialog.
   */
  onBudgetSaved(): void {
    this.showDialog.set(false);
    this.refreshData();
  }

  /**
   * Deletes a specific budget entry.
   * @param budget The budget object to delete.
   */
  deleteBudget(budget: Budget): void {
    this.confirmationService.confirm({
      header: 'Delete Budget?',
      message: `Are you sure you want to delete the budget for ${budget.category.name} in ${this.getMonthName(budget.month)} ${budget.year}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.budgetApi
          .deleteBudget(budget.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Budget deleted successfully');
              this.refreshData();
            },
            error: (err: any): void => {
              console.error('Failed to delete budget:', err);
              this.toast.error('Failed to delete budget');
            },
          });
      },
    });
  }

  /**
   * Maps a month number to its human-readable name.
   * @param month The month number (1-12).
   */
  getMonthName(month: number): string {
    return (
      this.monthOptions.find((m: MonthOption): boolean => m.value === month)?.label ||
      month.toString()
    );
  }

  /**
   * Returns appropriate Tailwind classes for the progress bar based on utilization.
   * @param percentage The percentage of the budget used.
   */
  getProgressBarTailwind(percentage: number): string {
    if (percentage < 80) return '!bg-emerald-500';
    if (percentage <= 100) return '!bg-amber-500';
    return '!bg-rose-500';
  }
}
