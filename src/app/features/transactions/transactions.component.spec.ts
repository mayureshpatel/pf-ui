import {ComponentFixture, TestBed} from '@angular/core/testing';
import {TransactionsComponent} from './transactions.component';
import {TransactionApiService} from './services/transaction-api.service';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {ConfirmationService, MessageService} from 'primeng/api';
import {ActivatedRoute, Router} from '@angular/router';
import {of} from 'rxjs';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {vi} from 'vitest';

describe('TransactionsComponent', () => {
  let component: TransactionsComponent;
  let fixture: ComponentFixture<TransactionsComponent>;
  let mockTransactionApi: any;
  let mockAccountApi: any;
  let mockCategoryApi: any;
  let mockToast: any;
  let mockConfirmationService: any;
  let mockRouter: any;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    mockTransactionApi = {
      getTransactions: vi.fn().mockReturnValue(of({
        content: [],
        page: {totalElements: 0, totalPages: 0, number: 0, size: 20}
      }))
    };
    mockAccountApi = {
      getAccounts: vi.fn().mockReturnValue(of([]))
    };
    mockCategoryApi = {
      getCategoriesWithTransactions: vi.fn().mockReturnValue(of([])),
      getMerchantsWithTransactions: vi.fn().mockReturnValue(of([]))
    };
    mockToast = {
      success: vi.fn(),
      error: vi.fn()
    };
    mockConfirmationService = {
      confirm: vi.fn()
    };
    mockRouter = {
      navigate: vi.fn()
    };
    mockActivatedRoute = {
      snapshot: {queryParams: {}},
      queryParams: of({})
    };

    await TestBed.configureTestingModule({
      imports: [TransactionsComponent, NoopAnimationsModule],
      providers: [
        {provide: TransactionApiService, useValue: mockTransactionApi},
        {provide: AccountApiService, useValue: mockAccountApi},
        {provide: CategoryApiService, useValue: mockCategoryApi},
        {provide: ToastService, useValue: mockToast},
        {provide: ConfirmationService, useValue: mockConfirmationService},
        {provide: MessageService, useValue: {}},
        {provide: Router, useValue: mockRouter},
        {provide: ActivatedRoute, useValue: mockActivatedRoute}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle onLazyLoad with dateIs filter', () => {
    // arrange
    const testDate = new Date('2026-03-12');
    const event = {
      first: 0,
      rows: 20,
      sortField: 'date',
      sortOrder: -1,
      filters: {
        date: {value: testDate, matchMode: 'dateIs'}
      }
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.startDate?.getTime()).toBe(testDate.getTime());
    expect(state.filter.endDate?.getTime()).toBe(testDate.getTime());
    expect(mockTransactionApi.getTransactions).toHaveBeenCalled();
  });

  it('should handle onLazyLoad with dateAfter and dateBefore filters', () => {
    // arrange
    const startDate = new Date('2026-03-01');
    const endDate = new Date('2026-03-31');
    const event = {
      first: 0,
      rows: 20,
      filters: {
        date: [
          {value: startDate, matchMode: 'dateAfter'},
          {value: endDate, matchMode: 'dateBefore'}
        ]
      }
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.startDate?.getTime()).toBe(startDate.getTime());
    expect(state.filter.endDate?.getTime()).toBe(endDate.getTime());
  });

  it('should clear date filters when cleared in UI', () => {
    // arrange
    component.state.set({
      filter: {startDate: new Date()},
      page: 0,
      size: 20,
      sort: 'date,desc'
    });
    const event = {
      first: 0,
      rows: 20,
      filters: {}
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.startDate).toBeUndefined();
    expect(state.filter.endDate).toBeUndefined();
  });

  it('should handle onLazyLoad with merchant and description filters', () => {
    // arrange
    const event = {
      first: 0,
      rows: 20,
      filters: {
        merchantAndDesc: [{
          value: { merchant: 'Amazon', description: 'cloud' },
          matchMode: 'custom'
        }]
      }
    };

    // act
    component.onLazyLoad(event);

    // assert & verify
    const state = component.state();
    expect(state.filter.merchant).toBe('Amazon');
    expect(state.filter.description).toBe('cloud');
  });
});
