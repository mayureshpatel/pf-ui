import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';

import { BudgetsComponent } from './budgets.component';
import { BudgetApiService } from './services/budget-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { Budget } from '@models/budget.model';
import { Category, CategoryType } from '@models/category.model';

/** Reproduces just the 2 ActivatedRoute members this component actually reads.
 * `queryParams` is a BehaviorSubject, not a plain `of(...)`, specifically to match the real
 * ActivatedRoute's own "replay the current value immediately on subscribe" semantics (PF-819's
 * fix relies on this: the component's `skip(1)` is built assuming exactly that first, synchronous
 * replay-on-subscribe exists to skip -- a plain cold Observable with no further emissions would
 * make that untestable). */
interface MockActivatedRoute {
  snapshot: { queryParams: Params };
  queryParams: BehaviorSubject<Params>;
}

describe('BudgetsComponent', () => {
  let component: BudgetsComponent;
  let fixture: ComponentFixture<BudgetsComponent>;
  let mockBudgetApi: Mocked<
    Pick<BudgetApiService, 'getBudgetStatus' | 'getAllBudgets' | 'deleteBudget'>
  >;
  let mockCategoryApi: Mocked<Pick<CategoryApiService, 'getCategories'>>;
  let mockToast: Mocked<Pick<ToastService, 'success' | 'error'>>;
  let mockConfirmationService: { confirm: Mock<(confirmation: Confirmation) => void> };
  let mockRouter: Mocked<Pick<Router, 'navigate'>>;
  let mockActivatedRoute: MockActivatedRoute;

  const category: Category = {
    id: 1,
    userId: 1,
    name: 'Rent',
    type: CategoryType.EXPENSE,
    parent: null,
    icon: 'pi-home',
    color: '#3B82F6',
  } as Category;

  const mockBudget: Budget = { id: 1, userId: 1, category, amount: 1000, month: 1, year: 2026 };

  const mockBudgetStatus = {
    category,
    budgetedAmount: 1000,
    spentAmount: 400,
    remainingAmount: 600,
    percentageUsed: 40,
  };

  beforeEach(async () => {
    mockBudgetApi = {
      getBudgetStatus: vi.fn().mockReturnValue(of([mockBudgetStatus])),
      getAllBudgets: vi.fn().mockReturnValue(
        of({
          content: [mockBudget],
          page: { totalElements: 1, totalPages: 1, number: 0, size: 20 },
        }),
      ),
      deleteBudget: vi.fn().mockReturnValue(of(undefined)),
    };
    mockCategoryApi = { getCategories: vi.fn().mockReturnValue(of([])) };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmationService = { confirm: vi.fn() };
    mockRouter = { navigate: vi.fn() };
    mockActivatedRoute = {
      snapshot: { queryParams: {} },
      queryParams: new BehaviorSubject<Params>({}),
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give the Delete Budget button an accessible name (PF-186)', () => {
    // "Manage All" view (where the Delete Budget button lives) only renders in viewMode 'all'
    component.viewMode.set('all');
    component.allBudgets.set([mockBudget]);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-trash)');
    expect(button.getAttribute('aria-label')).toBe('Delete Budget');
  });

  describe('category display (PF-216)', () => {
    it('should show the category name in the Monthly Status view', () => {
      // arrange & act -- default viewMode is 'monthly', budgetStatuses already populated
      component.budgetStatuses.set([mockBudgetStatus]);
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('Rent');
    });

    it('should show the category name in the Manage All view', () => {
      // arrange & act
      component.viewMode.set('all');
      component.allBudgets.set([mockBudget]);
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('Rent');
    });

    it("should color the Monthly Status icon with the category's own color", () => {
      // arrange & act
      component.budgetStatuses.set([mockBudgetStatus]);
      fixture.detectChanges();

      // assert & verify -- selected by its stable shape classes, not the icon glyph itself
      // (which is a separate bug under test elsewhere in this describe block)
      const icon: HTMLElement = fixture.nativeElement.querySelector('.rounded-xl');
      expect(icon.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3B82F6
    });

    it("should show the category's own icon glyph in the Monthly Status view", () => {
      // arrange & act
      component.budgetStatuses.set([mockBudgetStatus]);
      fixture.detectChanges();

      // assert & verify -- category.icon is 'pi-home', not the 'pi-tag' fallback
      expect(fixture.nativeElement.querySelector('.pi-home')).toBeTruthy();
    });
  });

  describe('Manage All pagination (PF-320)', () => {
    it('should request page 0 and populate allBudgets/allBudgetsTotalRecords on first entry into the view', () => {
      // act
      component.viewMode.set('all');
      component.onToggleView();

      // assert & verify
      expect(mockBudgetApi.getAllBudgets).toHaveBeenCalledWith({ page: 0, size: 20 });
      expect(component.allBudgets()).toEqual([mockBudget]);
      expect(component.allBudgetsTotalRecords()).toBe(1);
    });

    it('should reset to page 0 on a fresh entry into the view, even if a prior visit had paged further', () => {
      // arrange -- simulate having paged forward on a previous visit to 'all'
      component.allBudgetsPage.set(3);

      // act
      component.viewMode.set('all');
      component.onToggleView();

      // assert & verify
      expect(component.allBudgetsPage()).toBe(0);
      expect(mockBudgetApi.getAllBudgets).toHaveBeenCalledWith({ page: 0, size: 20 });
    });

    it('should request the corresponding page when the table lazy-loads a new offset', () => {
      // act
      component.onAllBudgetsPageChange({ first: 40 });

      // assert & verify
      expect(component.allBudgetsPage()).toBe(2);
      expect(mockBudgetApi.getAllBudgets).toHaveBeenCalledWith({ page: 2, size: 20 });
    });

    it('should preserve the current page when refreshing after a mutation (e.g. delete), not reset it', () => {
      // arrange
      component.allBudgetsPage.set(2);
      mockBudgetApi.getAllBudgets.mockClear();

      // act -- refreshData() while already in 'all' view (e.g. after onBudgetSaved/deleteBudget)
      component.viewMode.set('all');
      component.refreshData();

      // assert & verify
      expect(component.allBudgetsPage()).toBe(2);
      expect(mockBudgetApi.getAllBudgets).toHaveBeenCalledWith({ page: 2, size: 20 });
    });
  });

  describe('duplicate-request bug (PF-819)', () => {
    /** Finds the real rendered p-selectButton option by its own visible label text. Each
     * option's clickable element is <p-togglebutton>'s own HOST element (role="button" with a
     * host `click` listener -- confirmed in primeng-togglebutton.mjs -- not an inner <button>
     * tag), so a real DOM click on it exercises PrimeNG's real ControlValueAccessor + onChange
     * wiring, the same path a real user's click takes. */
    function findToggleOption(label: string): HTMLElement {
      const options: HTMLElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('p-togglebutton'),
      );
      const match = options.find((el) => el.textContent?.includes(label));
      if (!match) throw new Error(`No toggle option found for label "${label}"`);
      return match;
    }

    it('should request budget data exactly once for one real toggle click, not twice', () => {
      // arrange -- default viewMode is 'monthly'; clicking "Manage All" is a real value change
      mockBudgetApi.getAllBudgets.mockClear();

      // act -- a genuine click on the real rendered PrimeNG button, not a direct method call
      findToggleOption('Manage All').click();
      fixture.detectChanges();

      // assert & verify
      expect(component.viewMode()).toBe('all');
      expect(mockBudgetApi.getAllBudgets).toHaveBeenCalledTimes(1);
    });

    it('should request budget status exactly once when toggling back to Monthly Status', () => {
      // arrange -- reach 'all' via a real click too (a programmatic signal.set() doesn't
      // necessarily propagate down into PrimeNG's own internal selection state the same way a
      // real interaction does), then clear the call history from getting there
      findToggleOption('Manage All').click();
      fixture.detectChanges();
      expect(component.viewMode()).toBe('all');
      mockBudgetApi.getBudgetStatus.mockClear();

      // act
      findToggleOption('Monthly Status').click();
      fixture.detectChanges();

      // assert & verify
      expect(component.viewMode()).toBe('monthly');
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
    });

    /**
     * The actual root cause, found by live-reproducing the originally-reported symptom in a real
     * browser rather than trusting the ticket's own diagnosis: it's not p-selectButton at all
     * (the 2 tests above confirm the toggle itself fires exactly once, both directions). It's
     * `updateUrlParams()`'s router navigation racing the permanent `queryParams` subscription --
     * the subscription used to refresh unconditionally on every post-first emission, including
     * the one caused by the component's OWN navigation round-tripping back with no real change.
     */
    it('should call budget status exactly once on initial load, not twice', () => {
      // assert & verify -- the shared beforeEach's fixture.detectChanges() already ran ngOnInit;
      // nothing else has called the API yet in a fresh test
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
    });

    it('should NOT re-fetch when its own self-triggered URL update round-trips back with the same values it already has', () => {
      // arrange
      mockBudgetApi.getBudgetStatus.mockClear();
      const currentParams = {
        month: String(component.selectedMonth()),
        year: String(component.selectedYear()),
      };

      // act -- simulates updateUrlParams()'s own navigation landing back through the
      // subscription with values the component already has, exactly as happens in the real app
      mockActivatedRoute.queryParams.next(currentParams);

      // assert & verify
      expect(mockBudgetApi.getBudgetStatus).not.toHaveBeenCalled();
    });

    it('should re-fetch when a genuine external navigation changes the query params (e.g. browser back/forward, a shared link)', () => {
      // arrange
      mockBudgetApi.getBudgetStatus.mockClear();

      // act
      mockActivatedRoute.queryParams.next({ month: '3', year: '2024' });

      // assert & verify
      expect(component.selectedMonth()).toBe(3);
      expect(component.selectedYear()).toBe(2024);
      expect(mockBudgetApi.getBudgetStatus).toHaveBeenCalledTimes(1);
    });
  });
});
