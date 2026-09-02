import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';
import {ConfirmationService} from 'primeng/api';

import {BudgetsComponent} from './budgets.component';
import {BudgetApiService} from './services/budget-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {Budget} from '@models/budget.model';
import {Category, CategoryType} from '@models/category.model';

describe('BudgetsComponent', () => {
  let component: BudgetsComponent;
  let fixture: ComponentFixture<BudgetsComponent>;
  let mockBudgetApi: any;
  let mockCategoryApi: any;
  let mockToast: any;
  let mockConfirmationService: any;

  const category: Category = {
    id: 1,
    userId: 1,
    name: 'Rent',
    type: CategoryType.EXPENSE,
    parent: null,
    icon: 'pi-home',
    color: '#3B82F6'
  } as Category;

  const mockBudget: Budget = {id: 1, userId: 1, category, amount: 1000, month: 1, year: 2026};

  const mockBudgetStatus = {
    category,
    budgetedAmount: 1000,
    spentAmount: 400,
    remainingAmount: 600,
    percentageUsed: 40
  };

  beforeEach(async () => {
    mockBudgetApi = {
      getBudgetStatus: vi.fn().mockReturnValue(of([mockBudgetStatus])),
      getAllBudgets: vi.fn().mockReturnValue(of([mockBudget])),
      deleteBudget: vi.fn().mockReturnValue(of(undefined))
    };
    mockCategoryApi = {getCategories: vi.fn().mockReturnValue(of([]))};
    mockToast = {success: vi.fn(), error: vi.fn()};
    mockConfirmationService = {confirm: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [BudgetsComponent, NoopAnimationsModule],
      providers: [
        {provide: BudgetApiService, useValue: mockBudgetApi},
        {provide: CategoryApiService, useValue: mockCategoryApi},
        {provide: ToastService, useValue: mockToast},
        {provide: ConfirmationService, useValue: mockConfirmationService}
      ]
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
});
