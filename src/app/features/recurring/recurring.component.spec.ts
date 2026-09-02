import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';
import {ConfirmationService} from 'primeng/api';

import {RecurringComponent} from './recurring.component';
import {RecurringApiService} from './services/recurring-api.service';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {RecurringTransaction} from '@models/recurring.model';

describe('RecurringComponent', () => {
  let component: RecurringComponent;
  let fixture: ComponentFixture<RecurringComponent>;
  let mockRecurringApi: any;
  let mockAccountApi: any;
  let mockCategoryApi: any;
  let mockToast: any;
  let mockConfirmationService: any;

  const mockRecurring: RecurringTransaction = {
    id: 1,
    userId: 1,
    account: {name: 'Checking'},
    merchant: {cleanName: 'Netflix'},
    amount: 15.99,
    frequency: 'MONTHLY',
    nextDate: '2026-02-01',
    active: true
  } as unknown as RecurringTransaction;

  beforeEach(async () => {
    mockRecurringApi = {
      getAll: vi.fn().mockReturnValue(of([mockRecurring])),
      delete: vi.fn().mockReturnValue(of(undefined))
    };
    mockAccountApi = {getAccounts: vi.fn().mockReturnValue(of([]))};
    mockCategoryApi = {getMerchantsWithTransactions: vi.fn().mockReturnValue(of([]))};
    mockToast = {success: vi.fn(), error: vi.fn()};
    mockConfirmationService = {confirm: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [RecurringComponent, NoopAnimationsModule],
      providers: [
        {provide: RecurringApiService, useValue: mockRecurringApi},
        {provide: AccountApiService, useValue: mockAccountApi},
        {provide: CategoryApiService, useValue: mockCategoryApi},
        {provide: ToastService, useValue: mockToast},
        {provide: ConfirmationService, useValue: mockConfirmationService}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RecurringComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give the Edit Schedule button an accessible name (PF-186)', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-pencil)');
    expect(button.getAttribute('aria-label')).toBe('Edit Schedule');
  });

  it('should give the Delete Entry button an accessible name (PF-186)', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-trash)');
    expect(button.getAttribute('aria-label')).toBe('Delete Entry');
  });
});
