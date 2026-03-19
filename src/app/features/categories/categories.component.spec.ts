import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CategoriesComponent} from './categories.component';
import {CategoryApiService} from './services/category-api.service';
import {TransactionApiService} from '@features/transactions/services/transaction-api.service';
import {BudgetApiService} from '@features/budgets/services/budget-api.service';
import {ToastService} from '@core/services/toast.service';
import {ConfirmationService} from 'primeng/api';
import {Router} from '@angular/router';
import {of, throwError} from 'rxjs';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {Category, CategoryType} from '@models/category.model';

describe('CategoriesComponent', () => {
  let component: CategoriesComponent;
  let fixture: ComponentFixture<CategoriesComponent>;
  let mockCategoryApi: any;
  let mockTransactionApi: any;
  let mockBudgetApi: any;
  let mockToast: any;
  let mockConfirmationService: any;
  let mockRouter: any;

  const mockCategories: Category[] = [
    { id: 1, name: 'Food', type: CategoryType.EXPENSE, parent: null, icon: 'pi-shopping-cart', color: 'blue' } as Category,
    { id: 2, name: 'Groceries', type: CategoryType.EXPENSE, parent: { id: 1, name: 'Food' } as Category, icon: 'pi-shopping-cart', color: 'blue' } as Category,
    { id: 3, name: 'Dining Out', type: CategoryType.EXPENSE, parent: { id: 1, name: 'Food' } as Category, icon: 'pi-shopping-cart', color: 'blue' } as Category,
    { id: 4, name: 'Salary', type: CategoryType.INCOME, parent: null, icon: 'pi-money-bill', color: 'green' } as Category
  ];

  const mockTransactionCounts: Category[] = [
    { id: 2, transactionCount: 5 } as Category,
    { id: 3, transactionCount: 3 } as Category,
    { id: 4, transactionCount: 1 } as Category
  ];

  beforeEach(async () => {
    mockCategoryApi = {
      getCategories: vi.fn().mockReturnValue(of(mockCategories)),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn()
    };
    mockTransactionApi = {
      getCountsByCategory: vi.fn().mockReturnValue(of(mockTransactionCounts))
    };
    mockBudgetApi = {
      getBudgets: vi.fn().mockReturnValue(of([]))
    };
    mockToast = { success: vi.fn(), error: vi.fn() };
    mockConfirmationService = { confirm: vi.fn() };
    mockRouter = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CategoriesComponent, NoopAnimationsModule],
      providers: [
        { provide: CategoryApiService, useValue: mockCategoryApi },
        { provide: TransactionApiService, useValue: mockTransactionApi },
        { provide: BudgetApiService, useValue: mockBudgetApi },
        { provide: ToastService, useValue: mockToast },
        { provide: ConfirmationService, useValue: mockConfirmationService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesComponent);
    component = fixture.componentInstance;
  });

  it('should create and load data on init', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component).toBeTruthy();
    expect(mockCategoryApi.getCategories).toHaveBeenCalled();
    expect(mockTransactionApi.getCountsByCategory).toHaveBeenCalled();
    
    const groups = component.categories();
    expect(groups.length).toBe(2); // Food and Salary
    
    const foodGroup = groups.find(g => g.parent.id === 1);
    expect(foodGroup?.items.length).toBe(2);
    expect(foodGroup?.parent.transactionCount).toBe(8); // 5 + 3 + 0 (self)
    
    const salaryGroup = groups.find(g => g.parent.id === 4);
    expect(salaryGroup?.items.length).toBe(0);
    expect(salaryGroup?.parent.transactionCount).toBe(1);
  });

  it('should compute tableData correctly', () => {
    // act
    fixture.detectChanges();
    const tableData = component.tableData();

    // assert & verify
    // Food has 2 children, Salary has 0 (but added as lone parent child)
    expect(tableData.length).toBe(3); 
    expect(tableData.filter(c => c.parent?.id === 1).length).toBe(2);
    expect(tableData.filter(c => c.parent?.id === 4).length).toBe(1);
  });

  it('should handle load error gracefully', () => {
    // arrange
    mockCategoryApi.getCategories.mockReturnValue(throwError(() => new Error('API Error')));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load categories');
    expect(component.loading()).toBe(false);
  });

  it('should open create dialog', () => {
    // act
    component.openCreateDialog();

    // assert & verify
    expect(component.selectedCategory()).toBeNull();
    expect(component.showDialog()).toBe(true);
  });

  it('should open edit dialog', () => {
    // act
    component.openEditDialog(mockCategories[0]);

    // assert & verify
    expect(component.selectedCategory()).toEqual(mockCategories[0]);
    expect(component.showDialog()).toBe(true);
  });

  it('should delete category on confirmation', () => {
    // arrange
    mockConfirmationService.confirm.mockImplementation((config: any) => {
      if (config.accept) config.accept();
    });
    mockCategoryApi.deleteCategory.mockReturnValue(of(undefined));
    fixture.detectChanges();

    // act
    component.deleteCategory(mockCategories[3]); // Salary has 1 transaction, but let's assume it's deletable for test

    // assert & verify
    expect(mockCategoryApi.deleteCategory).toHaveBeenCalledWith(4);
    expect(mockToast.success).toHaveBeenCalledWith('Category deleted successfully');
    expect(mockCategoryApi.getCategories).toHaveBeenCalledTimes(2);
  });
});
