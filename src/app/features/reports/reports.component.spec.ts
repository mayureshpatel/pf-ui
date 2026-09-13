import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ActivatedRoute, Router} from '@angular/router';
import {of, throwError} from 'rxjs';
import {ReportsComponent} from './reports.component';
import {TransactionApiService} from '@features/transactions/services/transaction-api.service';
import {ToastService} from '@core/services/toast.service';
import {Transaction} from '@models/transaction.model';
import {CategoryReportComponent} from './components/category-report/category-report.component';
import {MerchantReportComponent} from './components/merchant-report/merchant-report.component';
import {IncomeExpenseReportComponent} from './components/income-expense-report/income-expense-report.component';

describe('ReportsComponent', () => {
  let fixture: ComponentFixture<ReportsComponent>;
  let component: ReportsComponent;
  let mockTransactionApi: any;
  let mockToast: any;
  let mockRouter: any;
  let mockActivatedRoute: any;

  const mockTransactions = [{
    id: 1, description: 'Test Txn', date: '2026-01-15', amount: 42.5, type: 'EXPENSE',
    account: {id: 1, name: 'Checking'}, category: {id: 1, name: 'Groceries'},
    merchant: {id: 1, cleanName: 'Test Merchant'}, tags: []
  }] as unknown as Transaction[];

  // p-tabs' TabList calls ngAfterViewInit -> bindResizeObserver(), which JSDOM doesn't implement.
  beforeAll(() => {
    (globalThis as any).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  });

  beforeEach(async () => {
    mockTransactionApi = {
      getTransactions: vi.fn().mockReturnValue(of({content: mockTransactions, page: {totalElements: 1}}))
    };
    mockToast = {success: vi.fn(), error: vi.fn(), info: vi.fn()};
    mockRouter = {navigate: vi.fn()};
    mockActivatedRoute = {
      snapshot: {queryParams: {}},
      queryParams: of({})
    };

    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        {provide: TransactionApiService, useValue: mockTransactionApi},
        {provide: ToastService, useValue: mockToast},
        {provide: Router, useValue: mockRouter},
        {provide: ActivatedRoute, useValue: mockActivatedRoute}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
  });

  it('should default to the Category tab (index 0)', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component.activeTabIndex()).toBe(0);
  });

  it('should load transactions on init using a "Last 3 Months" default range', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockTransactionApi.getTransactions).toHaveBeenCalledWith(
      expect.objectContaining({startDate: expect.any(Date), endDate: expect.any(Date)}),
      expect.objectContaining({page: 0, size: 1000, sort: 'date,desc'})
    );
    expect(component.dateRange().label).toBe('Last 3 Months');
  });

  it('should reload transactions when the date range changes', () => {
    // act
    fixture.detectChanges();
    mockTransactionApi.getTransactions.mockClear();
    component.dateRange.set({startDate: '2026-01-01', endDate: '2026-01-31', label: 'Custom Range'});
    fixture.detectChanges();

    // assert & verify
    const call = mockTransactionApi.getTransactions.mock.calls[0][0];
    expect(call.startDate.getFullYear()).toBe(2026);
    expect(call.startDate.getMonth()).toBe(0); // January
    expect(call.startDate.getDate()).toBe(1);
    expect(call.endDate.getDate()).toBe(31);
  });

  it('should pass the same loaded transactions down to all three sub-reports', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    const category = fixture.debugElement.query(By.directive(CategoryReportComponent)).componentInstance as CategoryReportComponent;
    const merchant = fixture.debugElement.query(By.directive(MerchantReportComponent)).componentInstance as MerchantReportComponent;
    const incomeExpense = fixture.debugElement.query(By.directive(IncomeExpenseReportComponent)).componentInstance as IncomeExpenseReportComponent;

    expect(category.transactions()).toEqual(mockTransactions);
    expect(merchant.transactions()).toEqual(mockTransactions);
    expect(incomeExpense.transactions()).toEqual(mockTransactions);
  });

  it('should switch the active tab when selected', () => {
    // act
    fixture.detectChanges();
    component.activeTabIndex.set(1);
    fixture.detectChanges();

    // assert & verify
    expect(component.activeTabIndex()).toBe(1);
  });

  it('should toggle the loading state around the request', () => {
    // act
    fixture.detectChanges();

    // assert & verify -- of(...) resolves synchronously
    expect(component.loading()).toBe(false);
  });

  it('should show an error toast and stop loading when the request fails', () => {
    // arrange
    mockTransactionApi.getTransactions.mockReturnValue(throwError(() => new Error('network error')));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load report data. Please try again.');
    expect(component.loading()).toBe(false);
  });
});
