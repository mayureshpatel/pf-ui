import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CategoryReportComponent} from './category-report.component';
import {Transaction, TransactionType} from '@models/transaction.model';
import {Category, CategoryType} from '@models/category.model';
import {getCategoryColor} from '@shared/utils/category.utils';

describe('CategoryReportComponent', () => {
  let component: CategoryReportComponent;
  let fixture: ComponentFixture<CategoryReportComponent>;

  const category = (id: number, name: string, color: string): Category =>
    ({id, userId: 1, name, type: CategoryType.EXPENSE, parent: null, icon: 'pi-tag', color}) as Category;

  const rent = category(1, 'Rent', '#3B82F6');
  const dining = category(2, 'Dining Out', '');

  const expense = (id: number, cat: Category, amount: number): Transaction =>
    ({
      id,
      account: {} as Transaction['account'],
      category: cat,
      amount,
      date: new Date('2026-01-15'),
      description: 'test',
      type: TransactionType.EXPENSE,
      merchant: {} as Transaction['merchant']
    }) as Transaction;

  const mockTransactions: Transaction[] = [
    expense(1, rent, 900),
    expense(2, dining, 120)
  ];

  const setTransactions = (data: Transaction[]): void => {
    fixture.componentRef.setInput('transactions', data);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryReportComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setTransactions(mockTransactions);

    expect(component).toBeTruthy();
  });

  describe('bar color', () => {
    it("should use the category's own color directly when one is set", () => {
      // arrange & act
      setTransactions(mockTransactions);
      const rentIndex = component.categoryData().findIndex((c): boolean => c.category.name === 'Rent');

      // assert & verify
      expect(component.chartData().datasets[0].backgroundColor[rentIndex]).toBe('#3B82F6');
      expect(component.chartData().datasets[0].hoverBackgroundColor[rentIndex]).toBe('#3B82F6');
    });

    it('should fall back to a name-derived color when the category has no color set', () => {
      // arrange & act
      setTransactions(mockTransactions);
      const diningIndex = component.categoryData().findIndex((c): boolean => c.category.name === 'Dining Out');

      // assert & verify
      const expected = getCategoryColor('Dining Out');
      expect(component.chartData().datasets[0].backgroundColor[diningIndex]).toBe(expected);
      expect(component.chartData().datasets[0].hoverBackgroundColor[diningIndex]).toBe(expected);
    });
  });
});
