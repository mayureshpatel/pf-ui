import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';

import {TransactionFormDrawerComponent} from './transaction-form-drawer.component';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {MerchantApiService} from '@features/merchants/services/merchant-api.service';

describe('TransactionFormDrawerComponent', () => {
  let component: TransactionFormDrawerComponent;
  let fixture: ComponentFixture<TransactionFormDrawerComponent>;

  beforeEach(async () => {
    const mockCategoryApi = {getCategories: vi.fn().mockReturnValue(of([]))};
    const mockAccountApi = {getAccounts: vi.fn().mockReturnValue(of([]))};
    const mockMerchantApi = {getMerchants: vi.fn().mockReturnValue(of([]))};

    await TestBed.configureTestingModule({
      imports: [TransactionFormDrawerComponent, NoopAnimationsModule],
      providers: [
        {provide: CategoryApiService, useValue: mockCategoryApi},
        {provide: AccountApiService, useValue: mockAccountApi},
        {provide: MerchantApiService, useValue: mockMerchantApi}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionFormDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
  });

  it('should default a new transaction\'s date to the local calendar date, not a UTC-shifted one, for a positive-UTC-offset user (PF-199)', () => {
    // Arrange -- the component builds its own `new Date()` internally, so there's no specific
    // instance to scope-mock; mock Date.prototype's local getters globally for just this test.
    // toISOString() is deliberately left un-mocked, so the old buggy code would still resolve
    // to whatever today's real UTC date is -- almost certainly not '2026-03-15'.
    const getFullYearSpy = vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026);
    const getMonthSpy = vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(2); // March, 0-indexed
    const getDateSpy = vi.spyOn(Date.prototype, 'getDate').mockReturnValue(15);

    try {
      fixture.detectChanges();

      // Act -- fires on drawer open, per the component's own (onShow) binding
      component.onShow();

      // Assert
      expect(component.form.get('transactionDate')?.value).toBe('2026-03-15');
    } finally {
      getFullYearSpy.mockRestore();
      getMonthSpy.mockRestore();
      getDateSpy.mockRestore();
    }
  });

  it('should preload an edited transaction\'s local calendar date, not a UTC-shifted one, when its date is a real Date instance (PF-199)', () => {
    // Arrange -- a moment where the local calendar date (March 15) differs from the UTC one
    // (March 14); mocked on this one specific Date instance, toISOString left un-mocked.
    const transactionDate = new Date(Date.UTC(2026, 2, 14, 15, 30, 0));
    vi.spyOn(transactionDate, 'getFullYear').mockReturnValue(2026);
    vi.spyOn(transactionDate, 'getMonth').mockReturnValue(2);
    vi.spyOn(transactionDate, 'getDate').mockReturnValue(15);

    fixture.componentRef.setInput('transaction', {
      id: 1,
      account: {id: 1, name: 'Checking'},
      category: null,
      amount: 42.5,
      date: transactionDate,
      description: 'Test',
      type: 'EXPENSE',
      merchant: null
    });
    fixture.detectChanges();

    // Act
    component.onShow();

    // Assert -- must match the local getters (2026-03-15), not toISOString's UTC date
    expect(component.form.get('transactionDate')?.value).toBe('2026-03-15');
  });
});
