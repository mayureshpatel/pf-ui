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

  beforeEach(async () => {
    mockBudgetApi = {
      getBudgetStatus: vi.fn().mockReturnValue(of([])),
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

    // "Manage All" view (where the Delete Budget button lives) only renders in viewMode 'all'
    component.viewMode.set('all');
    component.allBudgets.set([mockBudget]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give the Delete Budget button an accessible name (PF-186)', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-trash)');
    expect(button.getAttribute('aria-label')).toBe('Delete Budget');
  });
});
