import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';

import { BudgetsComponent } from './budgets.component';
import { BudgetApiService } from './services/budget-api.service';
import { BudgetCategoryViewComponent } from './components/budget-category-view/budget-category-view.component';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { Budget, BudgetStatus } from '@models/budget.model';
import { Category, CategoryType } from '@models/category.model';

/** Reproduces just the 2 ActivatedRoute members this component actually reads.
 * `queryParams` is a BehaviorSubject to match the real ActivatedRoute's replay-on-subscribe
 * semantics (PF-819's `skip(1)` is built on exactly that). */
interface MockActivatedRoute {
  snapshot: { queryParams: Params };
  queryParams: BehaviorSubject<Params>;
}

const cat = (id: number, name: string): Category =>
  ({
    id,
    userId: 1,
    name,
    type: CategoryType.EXPENSE,
    parent: null,
    icon: 'pi-tag',
    color: '#3B82F6',
  }) as Category;

const status = (category: Category, budgeted: number, spent: number): BudgetStatus => ({
  category,
  budgetedAmount: budgeted,
  spentAmount: spent,
  remainingAmount: budgeted - spent,
  percentageUsed: budgeted ? (spent / budgeted) * 100 : 0,
});

const budget = (id: number, category: Category, amount: number, month = 10): Budget => ({
  id,
  userId: 1,
  category,
  amount,
  month,
  year: 2026,
});

describe('BudgetsComponent', () => {
  let component: BudgetsComponent;
  let fixture: ComponentFixture<BudgetsComponent>;
  let mockBudgetApi: Mocked<
    Pick<
      BudgetApiService,
      'getBudgetStatus' | 'getBudgets' | 'createBudget' | 'updateBudget' | 'deleteBudget'
    >
  >;
  let mockCategoryApi: Mocked<Pick<CategoryApiService, 'getCategories'>>;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let mockConfirmationService: { confirm: Mock<(confirmation: Confirmation) => void> };
  let mockRouter: Mocked<Pick<Router, 'navigate'>>;
  let mockActivatedRoute: MockActivatedRoute;

  const groceries = cat(1, 'Groceries');
  const dining = cat(2, 'Dining out');
  const transport = cat(3, 'Transport');
  const travel = cat(4, 'Travel');
  const allCategories = [groceries, dining, transport, travel];
  const statuses = [
    status(groceries, 450, 512),
    status(dining, 200, 184),
    status(transport, 250, 96),
  ];
  const thisMonth = [
    budget(11, groceries, 450),
    budget(12, dining, 200),
    budget(13, transport, 250),
  ];
  const lastMonth = [
    budget(21, groceries, 450, 9),
    budget(22, dining, 180, 9),
    budget(23, travel, 100, 9),
  ];

  const confirmAccept = (index = 0): void =>
    mockConfirmationService.confirm.mock.calls[index][0].accept!();
  const dirtyCategoryForm = (): void => {
    fixture.detectChanges();
    const view = fixture.debugElement.query(By.directive(BudgetCategoryViewComponent))
      .componentInstance as BudgetCategoryViewComponent;
    view.form.markAsDirty();
  };

  beforeEach(async () => {
    mockBudgetApi = {
      getBudgetStatus: vi.fn().mockReturnValue(of(statuses)),
      getBudgets: vi
        .fn()
        .mockImplementation((month: number) => of(month === 10 ? thisMonth : lastMonth)),
      createBudget: vi.fn().mockReturnValue(of(99)),
      updateBudget: vi.fn().mockReturnValue(of(11)),
      deleteBudget: vi.fn().mockReturnValue(of(undefined)),
    };
    mockCategoryApi = { getCategories: vi.fn().mockReturnValue(of(allCategories)) };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmationService = { confirm: vi.fn() };
    mockRouter = { navigate: vi.fn() };
    mockActivatedRoute = {
      snapshot: { queryParams: { month: '10', year: '2026' } },
      queryParams: new BehaviorSubject<Params>({ month: '10', year: '2026' }),
    };

    await TestBed.configureTestingModule({
      imports: [BudgetsComponent, NoopAnimationsModule],
      providers: [
        { provide: BudgetApiService, useValue: mockBudgetApi },
        { provide: CategoryApiService, useValue: mockCategoryApi },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmationService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('loading', () => {
    it('should load the status, this month and last month together for the URL month', () => {
      // assert & verify
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledWith(10, 2026);
      expect(mockBudgetApi.getBudgets).toHaveBeenCalledWith(10, 2026);
      expect(mockBudgetApi.getBudgets).toHaveBeenCalledWith(9, 2026);
      expect(component.statuses()).toEqual(statuses);
      expect(component.loadedOnce()).toBe(true);
      expect(component.canCopy()).toBe(true);
    });

    it('should toast and flag the error when loading fails', () => {
      // arrange
      mockBudgetApi.getBudgetStatus.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadMonth();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to load budget data');
      expect(component.loadError()).toBe(true);
      expect(component.loading()).toBe(false);
    });
  });

  describe('modes and navigation', () => {
    it('should start in overview with the month totals and nothing selected', () => {
      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedCategoryId()).toBeNull();
      expect(component.panelTitle()).toBe('Overview');
      expect(component.totals().budgeted).toBe(900);
    });

    it('should open a category with its name as the panel title, and Back or Close return to overview', () => {
      // act
      component.openCategory(component.rows()[0]);

      // assert & verify
      expect(component.panelMode()).toBe('category');
      expect(component.panelTitle()).toBe('Groceries');

      // act
      component.back();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedCategoryId()).toBeNull();

      // act
      component.openCategory(component.rows()[0]);
      component.onPanelClose();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
    });

    it('should do nothing on Close or Escape in overview', () => {
      // act
      component.onPanelClose();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
    });

    it('should open add and return from it with Back', () => {
      // act
      component.startAdd();

      // assert & verify
      expect(component.panelMode()).toBe('add');
      expect(component.panelTitle()).toBe('Add budget');

      // act
      component.back();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
    });

    it('should offer only categories without a budget this month in the add form', () => {
      // assert & verify
      expect(component.availableCategories().map((c) => c.id)).toEqual([4]);
    });
  });

  describe('month', () => {
    it('should cross the year boundary and write the new month to the URL once', () => {
      // arrange
      mockActivatedRoute.snapshot.queryParams = { month: '12', year: '2026' };
      component.selectedMonth.set(12);
      component.selectedYear.set(2026);
      mockRouter.navigate.mockClear();

      // act
      component.nextMonth();

      // assert & verify
      expect(component.selectedMonth()).toBe(1);
      expect(component.selectedYear()).toBe(2027);
      expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
      expect(mockRouter.navigate.mock.calls[0][1]).toMatchObject({
        queryParams: { month: 1, year: 2027 },
      });
    });

    it('should return the panel to overview and reload when the month changes', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      mockBudgetApi.getBudgetStatus.mockClear();

      // act
      component.previousMonth();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedCategoryId()).toBeNull();
      expect(component.selectedMonth()).toBe(9);
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledWith(9, 2026);
    });

    it('should jump back to the current month with This month', () => {
      // act
      component.thisMonth();
      const now = new Date();

      // assert & verify
      expect(component.selectedMonth()).toBe(now.getMonth() + 1);
      expect(component.selectedYear()).toBe(now.getFullYear());
      expect(component.isCurrentMonth()).toBe(true);
    });

    it('should not reload twice when the router echoes our own URL (PF-819), but reload on an external change', () => {
      // arrange
      mockBudgetApi.getBudgetStatus.mockClear();

      // act -- the same month and year comes back from the router
      mockActivatedRoute.queryParams.next({ month: '10', year: '2026' });

      // assert & verify
      expect(mockBudgetApi.getBudgetStatus).not.toHaveBeenCalled();

      // act -- a genuine external change (browser back)
      mockActivatedRoute.queryParams.next({ month: '3', year: '2025' });

      // assert & verify
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledWith(3, 2025);
    });
  });

  describe('save limit', () => {
    it('should upsert once, toast, reload and stay on the category', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      mockBudgetApi.getBudgetStatus.mockClear();

      // act
      component.saveLimit(500);

      // assert & verify -- an existing budget is updated by id (create would be rejected as a duplicate)
      expect(mockBudgetApi.updateBudget).toHaveBeenCalledWith(11, 500);
      expect(mockBudgetApi.createBudget).not.toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('Budget updated');
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
      expect(component.panelMode()).toBe('category');
    });

    it('should ignore a second save while the first is in flight', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      mockBudgetApi.updateBudget.mockReturnValue(new Subject<number>());

      // act
      component.saveLimit(500);
      component.saveLimit(600);

      // assert & verify
      expect(mockBudgetApi.updateBudget).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBe(true);
    });

    it('should toast the API message and keep the panel when saving fails', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      mockBudgetApi.updateBudget.mockReturnValue(
        throwError(() => ({ error: { detail: 'Budget conflict' } })),
      );

      // act
      component.saveLimit(500);

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Budget conflict');
      expect(component.panelMode()).toBe('category');
      expect(component.saving()).toBe(false);
    });
  });

  describe('save limit without a known budget id', () => {
    it('should create the budget when the id could not be found', () => {
      // arrange -- the status line exists but its budget is not in this month's list
      mockBudgetApi.getBudgets.mockImplementation((month: number) =>
        of(month === 10 ? [] : lastMonth),
      );
      component.loadMonth();
      component.openCategory(component.rows()[0]);

      // act
      component.saveLimit(500);

      // assert & verify
      expect(mockBudgetApi.createBudget).toHaveBeenCalledWith(1, 500, 10, 2026);
      expect(mockBudgetApi.updateBudget).not.toHaveBeenCalled();
    });
  });

  describe('add budget', () => {
    it('should create the budget, open its category and reload', () => {
      // arrange
      component.startAdd();
      mockBudgetApi.getBudgetStatus.mockClear();
      // the reload after the create now includes the new category, as the backend would return it
      mockBudgetApi.getBudgetStatus.mockReturnValue(of([...statuses, status(travel, 120, 0)]));

      // act
      component.addBudget({ categoryId: 4, amount: 120 });

      // assert & verify
      expect(mockBudgetApi.createBudget).toHaveBeenCalledWith(4, 120, 10, 2026);
      expect(mockToast.success).toHaveBeenCalledWith('Budget added');
      expect(component.panelMode()).toBe('category');
      expect(component.selectedCategoryId()).toBe(4);
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
    });

    it('should still open the add form when every category already has a budget', () => {
      // arrange
      mockBudgetApi.getBudgets.mockImplementation(() =>
        of(allCategories.map((c, i) => budget(30 + i, c, 10))),
      );
      component.loadMonth();

      // act
      component.startAdd();

      // assert & verify
      expect(component.availableCategories()).toEqual([]);
      expect(component.panelMode()).toBe('add');
    });
  });

  describe('remove budget', () => {
    it('should confirm by name and month, then delete, toast, close and reload', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      mockBudgetApi.getBudgetStatus.mockClear();

      // act
      component.removeBudget();

      // assert & verify
      expect(mockConfirmationService.confirm.mock.calls[0][0].message).toContain('Groceries');
      expect(mockConfirmationService.confirm.mock.calls[0][0].message).toContain('October');
      expect(mockBudgetApi.deleteBudget).not.toHaveBeenCalled();

      // act
      confirmAccept();

      // assert & verify
      expect(mockBudgetApi.deleteBudget).toHaveBeenCalledWith(11);
      expect(mockToast.success).toHaveBeenCalledWith('Budget removed');
      expect(component.panelMode()).toBe('overview');
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
    });

    it('should never delete when the budget id is unknown', () => {
      // arrange -- the status line exists but its budget was created elsewhere after the list loaded
      mockBudgetApi.getBudgets.mockImplementation((month: number) =>
        of(month === 10 ? [] : lastMonth),
      );
      component.loadMonth();
      component.openCategory(component.rows()[0]);

      // act
      component.removeBudget();

      // assert & verify
      expect(component.rows()[0].budgetId).toBeNull();
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
      expect(mockBudgetApi.deleteBudget).not.toHaveBeenCalled();
    });

    it('should toast and keep the category when removing fails', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      mockBudgetApi.deleteBudget.mockReturnValue(throwError(() => ({})));

      // act
      component.removeBudget();
      confirmAccept();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Failed to remove budget');
      expect(component.panelMode()).toBe('category');
    });
  });

  describe('a category that disappears', () => {
    it('should return to overview and say so when the selected category is gone after a reload', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      mockBudgetApi.getBudgetStatus.mockReturnValue(of([status(dining, 200, 184)]));

      // act
      component.loadMonth();

      // assert & verify
      expect(component.panelMode()).toBe('overview');
      expect(component.selectedCategoryId()).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith('That budget no longer exists.');
    });

    it('should leave the add form open across a reload', () => {
      // arrange
      component.startAdd();

      // act
      component.loadMonth();

      // assert & verify
      expect(component.panelMode()).toBe('add');
    });
  });

  describe('unsaved edits', () => {
    it('should ask before leaving a dirty category form by any route, and not when pristine', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      fixture.detectChanges();

      // act -- pristine: no prompt
      component.openCategory(component.rows()[1]);

      // assert & verify
      expect(mockConfirmationService.confirm).not.toHaveBeenCalled();
      expect(component.selectedCategoryId()).toBe(dining.id);

      // arrange
      dirtyCategoryForm();

      // act and assert & verify -- every route asks and stays put
      component.openCategory(component.rows()[0]);
      component.back();
      component.onPanelClose();
      component.nextMonth();
      component.startAdd();
      component.viewTransactions();
      expect(mockConfirmationService.confirm).toHaveBeenCalledTimes(6);
      expect(component.panelMode()).toBe('category');
      expect(component.selectedMonth()).toBe(10);
      expect(mockRouter.navigate).not.toHaveBeenCalledWith(['/transactions'], expect.anything());
    });

    it('should proceed when the user chooses Discard', () => {
      // arrange
      component.openCategory(component.rows()[0]);
      dirtyCategoryForm();
      component.nextMonth();

      // act
      confirmAccept();

      // assert & verify
      expect(component.selectedMonth()).toBe(11);
      expect(component.panelMode()).toBe('overview');
    });
  });

  describe('view transactions', () => {
    it('should open Transactions for the category and the whole month', () => {
      // arrange
      component.openCategory(component.rows()[0]);

      // act
      component.viewTransactions();

      // assert & verify
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions'], {
        queryParams: { categoryName: 'Groceries', startDate: '2026-10-01', endDate: '2026-10-31' },
      });
    });
  });

  describe('copy last month', () => {
    const overviewButton = (name: string): HTMLButtonElement | undefined =>
      Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('app-budget-overview button'),
      ).find((b) => b.textContent?.trim() === name);

    it('should open the dialog from the overview with counts of what would be added and overwritten', () => {
      // act
      overviewButton("Copy last month's limits")?.click();
      fixture.detectChanges();

      // assert & verify
      expect(component.copyDialogVisible()).toBe(true);
      expect(component.copyCounts()).toEqual({ add: 1, overwrite: 1 });
      expect(component.previousMonthName()).toBe('September');
    });

    it('should hide Copy when last month has no budgets', () => {
      // arrange
      mockBudgetApi.getBudgets.mockImplementation((month: number) =>
        of(month === 10 ? thisMonth : []),
      );

      // act
      component.loadMonth();
      fixture.detectChanges();

      // assert & verify
      expect(component.canCopy()).toBe(false);
      expect(overviewButton("Copy last month's limits")).toBeUndefined();
    });

    it('should fill gaps only: add missing categories and never touch an existing limit', () => {
      // arrange
      mockBudgetApi.getBudgetStatus.mockClear();

      // act
      component.runCopy('fill');

      // assert & verify
      expect(mockBudgetApi.createBudget).toHaveBeenCalledTimes(1);
      expect(mockBudgetApi.createBudget).toHaveBeenCalledWith(4, 100, 10, 2026);
      expect(mockToast.success).toHaveBeenCalledWith('Added 1 limit');
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
      expect(component.panelMode()).toBe('overview');
    });

    it('should replace all: also overwrite differing limits, skip identical ones, and never remove this-month-only ones', () => {
      // act
      component.runCopy('replace');

      // assert & verify
      // the missing category is created, the differing one is updated by its id, identical ones are skipped
      expect(mockBudgetApi.createBudget).toHaveBeenCalledTimes(1);
      expect(mockBudgetApi.createBudget).toHaveBeenCalledWith(4, 100, 10, 2026);
      expect(mockBudgetApi.updateBudget).toHaveBeenCalledTimes(1);
      expect(mockBudgetApi.updateBudget).toHaveBeenCalledWith(12, 180);
      expect(mockBudgetApi.deleteBudget).not.toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('Added 2 limits');
    });

    it('should report a partial failure, still reload and not claim full success', () => {
      // arrange
      mockBudgetApi.updateBudget.mockReturnValue(throwError(() => ({})));
      mockBudgetApi.getBudgetStatus.mockClear();

      // act
      component.runCopy('replace');

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Added 1 limit, 1 failed');
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBe(false);
    });

    it('should ignore a second copy while the first is still running', () => {
      // arrange
      mockBudgetApi.createBudget.mockReturnValue(new Subject<number>());

      // act
      component.runCopy('fill');
      component.runCopy('fill');

      // assert & verify
      expect(mockBudgetApi.createBudget).toHaveBeenCalledTimes(1);
      expect(component.saving()).toBe(true);
    });

    it('should just reload when there is nothing to copy', () => {
      // arrange
      mockBudgetApi.getBudgets.mockImplementation(() => of(thisMonth));
      component.loadMonth();
      mockBudgetApi.getBudgetStatus.mockClear();

      // act
      component.runCopy('fill');

      // assert & verify
      expect(mockBudgetApi.createBudget).not.toHaveBeenCalled();
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('layout and states', () => {
    const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');

    it('should always render the panel, showing the overview with what is left to spend', () => {
      // assert & verify
      expect(aside().getAttribute('aria-label')).toBe('Overview');
      expect(
        fixture.nativeElement.querySelector('[data-testid="left-to-spend"]').textContent,
      ).toContain('$108.00');
    });

    it('should show the full skeleton on the first load only, with no panel yet', () => {
      // arrange
      const first = TestBed.createComponent(BudgetsComponent);
      mockBudgetApi.getBudgetStatus.mockReturnValue(new Subject<BudgetStatus[]>());

      // act
      first.detectChanges();

      // assert & verify
      expect(first.nativeElement.querySelector('[aria-busy="true"] p-skeleton')).toBeTruthy();
      expect(first.nativeElement.querySelector('app-side-panel')).toBeNull();
    });

    it('should keep the same panel element mounted across a month change and a save', () => {
      // arrange
      const panel = fixture.nativeElement.querySelector('app-side-panel');

      // act
      component.nextMonth();
      fixture.detectChanges();
      component.openCategory(component.rows()[0]);
      component.saveLimit(1);
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-side-panel')).toBe(panel);
    });

    it('should show a skeleton in the panel body for a just-added category that has not loaded yet', () => {
      // arrange
      component.selectedCategoryId.set(4);
      component.panelMode.set('category');

      // act
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-side-panel p-skeleton')).toBeTruthy();
    });

    it('should show the empty month message and keep Add budget available', () => {
      // arrange
      mockBudgetApi.getBudgetStatus.mockReturnValue(of([]));
      mockBudgetApi.getBudgets.mockImplementation(() => of([]));

      // act
      component.loadMonth();
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('No budgets for October');
      expect(fixture.nativeElement.querySelector('app-budget-list')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-budget-overview')).toBeTruthy();
    });

    it('should show the empty month message above spending that has no limit, and keep it out of the totals', () => {
      // arrange -- the backend reports spent categories with no budget as a $0 limit
      mockBudgetApi.getBudgetStatus.mockReturnValue(of([status(travel, 0, 120)]));
      mockBudgetApi.getBudgets.mockImplementation(() => of([]));

      // act
      component.loadMonth();
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('No budgets for October');
      expect(fixture.nativeElement.querySelector('app-budget-list')).toBeTruthy();
      expect(component.totals()).toEqual({ budgeted: 0, spent: 0, left: 0, unbudgeted: 120 });
    });

    it('should show the error state with retry when nothing could be loaded', () => {
      // arrange
      component.statuses.set([]);
      mockBudgetApi.getBudgetStatus.mockReturnValue(throwError(() => new Error('down')));

      // act
      component.loadMonth();
      fixture.detectChanges();
      mockBudgetApi.getBudgetStatus.mockReturnValue(of(statuses));
      fixture.nativeElement.querySelector('app-page-error-state button')?.click();
      fixture.detectChanges();

      // assert & verify
      expect(component.loadError()).toBe(false);
      expect(component.statuses()).toEqual(statuses);
    });

    it('should no longer offer the old Manage all view, summary cards or paginator', () => {
      // assert & verify
      const text: string = fixture.nativeElement.textContent;
      expect(text).not.toContain('Manage All');
      expect(text).not.toContain('Total Budgeted');
      expect(fixture.nativeElement.querySelector('p-paginator')).toBeNull();
      expect(fixture.nativeElement.querySelector('p-table')).toBeNull();
    });
  });

  describe('focus', () => {
    const aside = (): HTMLElement => fixture.nativeElement.querySelector('app-side-panel aside');
    const rowButton = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-testid="open-budget"]');

    it('should not take focus on page load', async () => {
      // arrange
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).not.toBe(aside());
    });

    it('should move focus into the panel when a row is opened and back to that row on return', async () => {
      // arrange
      const row = rowButton();
      row.focus();

      // act
      component.openCategory(component.rows()[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());

      // act
      component.closePanel();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(row);
    });

    it('should focus the panel instead when the element that opened it is gone', async () => {
      // arrange
      rowButton().focus();
      component.openCategory(component.rows()[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      // act -- the opening row disappears from the list, then the panel returns to overview
      component.statuses.set([status(dining, 200, 184)]);
      fixture.detectChanges();
      component.closePanel();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());
    });

    it('should move focus into the panel when add opens', async () => {
      // arrange
      (document.activeElement as HTMLElement | null)?.blur();

      // act
      component.startAdd();
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(document.activeElement).toBe(aside());
    });
  });
});
