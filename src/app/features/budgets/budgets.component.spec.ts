import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { ConfirmationService } from 'primeng/api';

import { BudgetsComponent } from './budgets.component';
import { BudgetApiService } from './services/budget-api.service';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { Budget } from '@models/budget.model';
import { Category, CategoryType } from '@models/category.model';

describe('BudgetsComponent', () => {
  let component: BudgetsComponent;
  let fixture: ComponentFixture<BudgetsComponent>;
  let mockBudgetApi: any;
  let mockCategoryApi: any;
  let mockToast: any;
  let mockConfirmationService: any;
  let mockRouter: any;
  let mockActivatedRoute: any;

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
        of({ content: [mockBudget], page: { totalElements: 1, totalPages: 1, number: 0, size: 20 } }),
      ),
      deleteBudget: vi.fn().mockReturnValue(of(undefined)),
    };
    mockCategoryApi = { getCategories: vi.fn().mockReturnValue(of([])) };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmationService = { confirm: vi.fn() };
    mockRouter = { navigate: vi.fn() };
    mockActivatedRoute = {
      snapshot: { queryParams: {} },
      queryParams: of({}),
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
      component.budgetStatuses.set([mockBudgetStatus as any]);
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
      component.budgetStatuses.set([mockBudgetStatus as any]);
      fixture.detectChanges();

      // assert & verify -- selected by its stable shape classes, not the icon glyph itself
      // (which is a separate bug under test elsewhere in this describe block)
      const icon: HTMLElement = fixture.nativeElement.querySelector('.rounded-xl');
      expect(icon.style.backgroundColor).toBe('rgb(59, 130, 246)'); // #3B82F6
    });

    it("should show the category's own icon glyph in the Monthly Status view", () => {
      // arrange & act
      component.budgetStatuses.set([mockBudgetStatus as any]);
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
});
