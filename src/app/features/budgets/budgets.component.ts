import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  OnInit,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, Observable, of, skip } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService } from 'primeng/api';

import { Budget, BudgetStatus } from '@models/budget.model';
import { Category } from '@models/category.model';
import { BudgetApiService } from './services/budget-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { toLocalDateString } from '@shared/utils/transaction.utils';
import { BudgetListComponent } from './components/budget-list/budget-list.component';
import { BudgetOverviewComponent } from './components/budget-overview/budget-overview.component';
import { BudgetCopyDialogComponent } from './components/budget-copy-dialog/budget-copy-dialog.component';
import { BudgetCategoryViewComponent } from './components/budget-category-view/budget-category-view.component';
import { BudgetAddFormComponent } from './components/budget-add-form/budget-add-form.component';
import {
  BudgetRow,
  BudgetRowGroup,
  BudgetTotals,
  budgetRows,
  budgetTotals,
  copyPlan,
  groupBudgetRows,
  isSameMonth,
  monthLabel,
  monthName,
  shiftMonth,
  unbudgetedCategories,
} from './utils/budget-helpers';

/** What the docked panel is showing. */
export type BudgetPanelMode = 'overview' | 'category' | 'add';

/**
 * The Budgets page: a month's categories in three groups beside an always-present panel. The panel
 * shows the month overview by default, and a category's limit editor or the add form on request.
 */
@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ScreenToolbarComponent,
    PageErrorStateComponent,
    SidePanelComponent,
    BudgetListComponent,
    BudgetOverviewComponent,
    BudgetCategoryViewComponent,
    BudgetAddFormComponent,
    BudgetCopyDialogComponent,
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

  readonly statuses: WritableSignal<BudgetStatus[]> = signal([]);
  /** This month's budgets (they carry the ids needed to remove one). */
  readonly budgets: WritableSignal<Budget[]> = signal([]);
  /** Last month's budgets, the source for Copy. */
  readonly previousBudgets: WritableSignal<Budget[]> = signal([]);
  readonly categories: WritableSignal<Category[]> = signal([]);

  readonly loading: WritableSignal<boolean> = signal(false);
  readonly loadError: WritableSignal<boolean> = signal(false);
  /** True once a month has loaded; later reloads dim the list instead of replacing the page. */
  readonly loadedOnce: WritableSignal<boolean> = signal(false);
  /** A save or remove request is in flight. */
  readonly saving: WritableSignal<boolean> = signal(false);

  readonly selectedMonth: WritableSignal<number> = signal(new Date().getMonth() + 1);
  readonly selectedYear: WritableSignal<number> = signal(new Date().getFullYear());

  readonly panelMode: WritableSignal<BudgetPanelMode> = signal('overview');
  readonly selectedCategoryId: WritableSignal<number | null> = signal(null);

  readonly rows: Signal<BudgetRow[]> = computed((): BudgetRow[] =>
    budgetRows(this.statuses(), this.budgets()),
  );
  readonly groups: Signal<BudgetRowGroup[]> = computed((): BudgetRowGroup[] =>
    groupBudgetRows(this.rows()),
  );
  readonly totals: Signal<BudgetTotals> = computed((): BudgetTotals => budgetTotals(this.rows()));
  readonly monthName: Signal<string> = computed((): string => monthName(this.selectedMonth()));
  readonly monthLabel: Signal<string> = computed((): string =>
    monthLabel(this.selectedMonth(), this.selectedYear()),
  );
  readonly isCurrentMonth: Signal<boolean> = computed((): boolean =>
    isSameMonth(this.selectedMonth(), this.selectedYear()),
  );
  readonly selectedRow: Signal<BudgetRow | null> = computed(
    (): BudgetRow | null =>
      this.rows().find(
        (row: BudgetRow): boolean => row.status.category.id === this.selectedCategoryId(),
      ) ?? null,
  );
  readonly availableCategories: Signal<Category[]> = computed((): Category[] =>
    unbudgetedCategories(this.categories(), this.budgets()),
  );
  /** Whether the Copy dialog is showing. */
  readonly copyDialogVisible: WritableSignal<boolean> = signal(false);
  /** How many categories Copy would add and how many existing limits it would overwrite. */
  readonly copyCounts: Signal<{ add: number; overwrite: number }> = computed(
    (): { add: number; overwrite: number } => {
      const plan = copyPlan(this.previousBudgets(), this.budgets());
      return { add: plan.add.length, overwrite: plan.overwrite.length };
    },
  );
  readonly previousMonthName: Signal<string> = computed((): string =>
    monthName(shiftMonth(this.selectedMonth(), this.selectedYear(), -1).month),
  );
  readonly canCopy: Signal<boolean> = computed((): boolean => this.previousBudgets().length > 0);

  readonly panelTitle: Signal<string> = computed((): string => {
    switch (this.panelMode()) {
      case 'add':
        return 'Add budget';
      case 'category':
        return this.selectedRow()?.status.category.name ?? 'Budget';
      default:
        return 'Overview';
    }
  });

  private readonly injector: Injector = inject(Injector);
  private readonly panel = viewChild(SidePanelComponent);

  /** The element that had focus when the panel left the overview, to hand focus back to. */
  private focusReturn: HTMLElement | null = null;

  private readonly categoryView = viewChild<BudgetCategoryViewComponent>('categoryView');
  private readonly addForm = viewChild<BudgetAddFormComponent>('addForm');

  /**
   * Hydrates the month from the URL first so a shared or refreshed link loads the right month, then
   * keeps it in sync with later external navigation (browser back and forward).
   *
   * PF-819: our own `updateUrlParams()` navigation echoes back through the `queryParams`
   * subscription; `hydrateFromParams` reports whether anything really changed, so only a genuine
   * external change triggers a second load.
   */
  ngOnInit(): void {
    this.hydrateFromParams(this.route.snapshot.queryParams);
    this.loadCategories();
    this.updateUrlParams();
    this.loadMonth();

    this.route.queryParams
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params: Params): void => {
        if (this.hydrateFromParams(params)) {
          this.closePanel();
          this.loadMonth();
        }
      });
  }

  /** Loads the status, this month's budgets and last month's budgets together. */
  loadMonth(): void {
    const month: number = this.selectedMonth();
    const year: number = this.selectedYear();
    const previous: { month: number; year: number } = shiftMonth(month, year, -1);
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      statuses: this.budgetApi.getBudgetStatus(month, year),
      budgets: this.budgetApi.getBudgets(month, year),
      previousBudgets: this.budgetApi.getBudgets(previous.month, previous.year),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: ({ statuses, budgets, previousBudgets }): void => {
          this.statuses.set(statuses);
          this.budgets.set(budgets);
          this.previousBudgets.set(previousBudgets);
          this.loadedOnce.set(true);
          this.closePanelIfCategoryGone();
        },
        error: (err: unknown): void => {
          console.error('Failed to load budget data:', err);
          this.toast.error('Failed to load budget data');
          this.loadError.set(true);
        },
      });
  }

  previousMonth(): void {
    const target = shiftMonth(this.selectedMonth(), this.selectedYear(), -1);
    this.goToMonth(target.month, target.year);
  }

  nextMonth(): void {
    const target = shiftMonth(this.selectedMonth(), this.selectedYear(), 1);
    this.goToMonth(target.month, target.year);
  }

  thisMonth(): void {
    const now: Date = new Date();
    this.goToMonth(now.getMonth() + 1, now.getFullYear());
  }

  /** Changes the month (after the discard prompt), returns to overview, updates the URL and loads. */
  goToMonth(month: number, year: number): void {
    this.confirmDiscardIfDirty((): void => {
      this.selectedMonth.set(month);
      this.selectedYear.set(year);
      this.closePanel();
      this.updateUrlParams();
      this.loadMonth();
    });
  }

  /** Opens the dialog that asks how to copy last month's limits. */
  openCopyDialog(): void {
    this.copyDialogVisible.set(true);
  }

  /**
   * Copies last month's limits into this month. Fill gaps adds only categories with no limit yet;
   * Replace all also overwrites limits that differ. Categories budgeted only this month are never
   * touched. Requests run in parallel and a failure of one does not stop the others.
   */
  runCopy(mode: 'fill' | 'replace'): void {
    if (this.saving()) return;
    const plan = copyPlan(this.previousBudgets(), this.budgets());
    const items: Budget[] = mode === 'fill' ? plan.add : [...plan.add, ...plan.overwrite];
    if (items.length === 0) {
      this.loadMonth();
      return;
    }
    this.saving.set(true);
    const month: number = this.selectedMonth();
    const year: number = this.selectedYear();
    const currentIds = new Map<number, number>(
      this.budgets().map((b: Budget): [number, number] => [b.category.id, b.id]),
    );
    const calls: Observable<boolean>[] = items.map((item: Budget): Observable<boolean> => {
      const existingId: number | undefined = currentIds.get(item.category.id);
      // a category that already has a limit this month is updated by id, a missing one is created
      const request: Observable<number> =
        existingId !== undefined
          ? this.budgetApi.updateBudget(existingId, item.amount)
          : this.budgetApi.createBudget(item.category.id, item.amount, month, year);
      return request.pipe(
        map((): boolean => true),
        catchError((): Observable<boolean> => of(false)),
      );
    });
    forkJoin(calls)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe((results: boolean[]): void => {
        const added: number = results.filter(Boolean).length;
        const failed: number = results.length - added;
        const noun: string = added === 1 ? 'limit' : 'limits';
        if (failed === 0) {
          this.toast.success(`Added ${added} ${noun}`);
        } else {
          this.toast.error(`Added ${added} ${noun}, ${failed} failed`);
        }
        this.loadMonth();
      });
  }

  /** Shows a category in the panel. */
  openCategory(row: BudgetRow): void {
    if (this.panelMode() === 'category' && this.selectedCategoryId() === row.status.category.id) {
      return;
    }
    this.confirmDiscardIfDirty((): void => {
      this.selectedCategoryId.set(row.status.category.id);
      this.go('category');
    });
  }

  /** Opens the panel to add a budget. */
  startAdd(): void {
    if (this.panelMode() === 'add') return;
    this.confirmDiscardIfDirty((): void => {
      this.selectedCategoryId.set(null);
      this.go('add');
    });
  }

  /** Back from category or add to the overview. */
  back(): void {
    if (this.panelMode() === 'overview') return;
    this.confirmDiscardIfDirty((): void => this.closePanel());
  }

  /** Returns to the overview with nothing selected, without asking. */
  closePanel(): void {
    this.selectedCategoryId.set(null);
    this.go('overview');
  }

  /** Close button and Escape: asks first when there are unsaved edits; the overview ignores them. */
  onPanelClose(): void {
    if (this.panelMode() === 'overview') return;
    this.confirmDiscardIfDirty((): void => this.closePanel());
  }

  /** The panel's Save button: submits whichever form is showing. */
  onPanelSave(): void {
    if (this.panelMode() === 'category') {
      this.categoryView()?.submit();
    } else if (this.panelMode() === 'add') {
      this.addForm()?.submit();
    }
  }

  /** Sets the selected category's limit for this month (the backend upserts). */
  saveLimit(amount: number): void {
    const row: BudgetRow | null = this.selectedRow();
    if (!row || this.saving()) return;
    this.saving.set(true);
    // an existing budget is updated by id; the backend rejects a second create for the same month
    const request: Observable<number> =
      row.budgetId !== null
        ? this.budgetApi.updateBudget(row.budgetId, amount)
        : this.budgetApi.createBudget(
            row.status.category.id,
            amount,
            this.selectedMonth(),
            this.selectedYear(),
          );
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Budget updated');
          this.categoryView()?.form.markAsPristine();
          this.loadMonth();
        },
        error: (error: HttpErrorResponse): void => {
          console.error('Error saving budget:', error);
          this.toast.error(error.error?.detail || 'Failed to save budget');
        },
      });
  }

  /** Adds a budget for a category with no limit this month, then opens it. */
  addBudget(request: { categoryId: number; amount: number }): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.budgetApi
      .createBudget(request.categoryId, request.amount, this.selectedMonth(), this.selectedYear())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Budget added');
          this.addForm()?.form.markAsPristine();
          this.selectedCategoryId.set(request.categoryId);
          this.go('category');
          this.loadMonth();
        },
        error: (error: HttpErrorResponse): void => {
          console.error('Error adding budget:', error);
          this.toast.error(error.error?.detail || 'Failed to add budget');
        },
      });
  }

  /** Confirms, then removes the selected category's budget for this month. */
  removeBudget(): void {
    const row: BudgetRow | null = this.selectedRow();
    if (!row || row.budgetId === null) return;
    const budgetId: number = row.budgetId;
    this.confirmationService.confirm({
      header: 'Remove budget?',
      message: `Remove the ${row.status.category.name} budget for ${this.monthName()}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remove',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.budgetApi
          .deleteBudget(budgetId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Budget removed');
              this.closePanel();
              this.loadMonth();
            },
            error: (error: unknown): void => {
              console.error('Failed to remove budget:', error);
              this.toast.error('Failed to remove budget');
            },
          });
      },
    });
  }

  /** Opens Transactions for the selected category across the whole month. */
  viewTransactions(): void {
    const row: BudgetRow | null = this.selectedRow();
    if (!row) return;
    this.confirmDiscardIfDirty((): void => {
      const month: number = this.selectedMonth();
      const year: number = this.selectedYear();
      void this.router.navigate(['/transactions'], {
        queryParams: {
          categoryName: row.status.category.name,
          startDate: toLocalDateString(new Date(year, month - 1, 1)),
          endDate: toLocalDateString(new Date(year, month, 0)),
        },
      });
    });
  }

  /** Switches mode and moves focus: into the panel for any step, back to the opener for overview. */
  private go(mode: BudgetPanelMode): void {
    if (this.panelMode() === 'overview' && mode !== 'overview') {
      this.focusReturn = document.activeElement as HTMLElement | null;
    }
    this.panelMode.set(mode);
    afterNextRender(
      (): void => {
        const target: HTMLElement | null = this.focusReturn;
        if (mode === 'overview' && target?.isConnected) {
          target.focus();
        } else {
          this.panel()?.focus();
        }
        if (mode === 'overview') this.focusReturn = null;
      },
      { injector: this.injector },
    );
  }

  /** A reload that no longer contains the shown category (removed elsewhere) closes the panel. */
  private closePanelIfCategoryGone(): void {
    const id: number | null = this.selectedCategoryId();
    if (this.panelMode() !== 'category' || id === null) return;
    if (this.rows().some((row: BudgetRow): boolean => row.status.category.id === id)) return;
    this.closePanel();
    this.toast.error('That budget no longer exists.');
  }

  /** Runs an action that would replace a form, after asking when that form has unsaved changes. */
  private confirmDiscardIfDirty(proceed: () => void): void {
    const mode: BudgetPanelMode = this.panelMode();
    const dirty: boolean =
      (mode === 'category' && !!this.categoryView()?.form.dirty) ||
      (mode === 'add' && !!this.addForm()?.form.dirty);
    if (!dirty) {
      proceed();
      return;
    }
    this.confirmationService.confirm({
      header: 'Discard changes?',
      message: 'You have unsaved changes. Discard them?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep editing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: proceed,
    });
  }

  /**
   * Translates URL query params into the month and year signals, only writing when the parsed value
   * differs from the current one.
   *
   * @return whether either signal was written (a genuine change).
   */
  private hydrateFromParams(params: Params): boolean {
    const month: number | undefined = params['month'] ? Number(params['month']) : undefined;
    const year: number | undefined = params['year'] ? Number(params['year']) : undefined;
    let changed = false;
    if (month !== undefined && month !== this.selectedMonth()) {
      this.selectedMonth.set(month);
      changed = true;
    }
    if (year !== undefined && year !== this.selectedYear()) {
      this.selectedYear.set(year);
      changed = true;
    }
    return changed;
  }

  /** Writes the month and year to the URL (always, since some month is always selected). */
  private updateUrlParams(): void {
    void this.router.navigate([], {
      queryParams: { month: this.selectedMonth(), year: this.selectedYear() },
      queryParamsHandling: 'replace',
      replaceUrl: true,
    });
  }

  /** Fetches the categories offered by the add form. */
  private loadCategories(): void {
    this.categoryApi
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories: Category[]): void => this.categories.set(categories),
        error: (err: unknown): void => {
          console.error('Failed to load categories:', err);
          this.toast.error('Failed to load categories');
        },
      });
  }
}
