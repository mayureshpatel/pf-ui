import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Account, AccountType, BalanceEntryRequest } from '@models/account.model';
import { toLocalDateString } from '@shared/utils/transaction.utils';
import { AccountBalanceFormComponent } from './account-balance-form.component';

describe('AccountBalanceFormComponent', () => {
  let fixture: ComponentFixture<AccountBalanceFormComponent>;
  let component: AccountBalanceFormComponent;

  const account = (typeCode = 'INVESTMENT'): Account =>
    ({
      id: 7,
      name: 'Roth IRA',
      currentBalance: 12000,
      currency: { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
      type: { code: typeCode, label: typeCode, isAsset: typeCode !== 'LOAN' } as AccountType,
      balanceMode: 'MANUAL',
      version: 4,
    }) as Account;

  const setup = (a: Account): void => {
    fixture = TestBed.createComponent(AccountBalanceFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('account', a);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountBalanceFormComponent, NoopAnimationsModule],
    }).compileComponents();
  });

  it('should default the date to today and cap it at today', () => {
    // act
    setup(account());

    // assert & verify
    expect(toLocalDateString(component.form.controls.asOfDate.value!)).toBe(
      toLocalDateString(new Date()),
    );
    expect(toLocalDateString(component.maxDate)).toBe(toLocalDateString(new Date()));
  });

  it('should be invalid, and emit nothing, for an empty balance', () => {
    // arrange
    setup(account());
    const spy = vi.fn();
    component.recorded.subscribe(spy);

    // act
    component.submit();

    // assert & verify
    expect(component.form.invalid).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should emit accountId, balance, asOfDate and version', () => {
    // arrange
    setup(account());
    const spy = vi.fn();
    component.recorded.subscribe(spy);
    component.form.patchValue({ balance: 12500.5, asOfDate: new Date(2026, 10, 9) });

    // act
    component.submit();

    // assert & verify
    expect(spy).toHaveBeenCalledWith({
      accountId: 7,
      balance: 12500.5,
      asOfDate: '2026-11-09',
      version: 4,
    } satisfies BalanceEntryRequest);
  });

  it('should accept a negative balance on a non-loan account', () => {
    // arrange
    setup(account());
    component.form.patchValue({ balance: -50 });

    // assert & verify
    expect(component.form.controls.balance.valid).toBe(true);
  });

  it('should accept only non-negative amounts for a loan', () => {
    // arrange
    setup(account('LOAN'));

    // act
    component.form.patchValue({ balance: -50 });

    // assert & verify
    expect(component.form.controls.balance.valid).toBe(false);

    component.form.patchValue({ balance: 18000 });
    expect(component.form.controls.balance.valid).toBe(true);
  });

  it('should not emit while saving', () => {
    // arrange
    setup(account());
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    const spy = vi.fn();
    component.recorded.subscribe(spy);
    component.form.patchValue({ balance: 100 });

    // act
    component.submit();

    // assert & verify
    expect(spy).not.toHaveBeenCalled();
  });

  it('should say what the current balance is, in cents-safe terms, and unchanged balance still submits', () => {
    // arrange
    setup(account());
    const spy = vi.fn();
    component.recorded.subscribe(spy);
    component.form.patchValue({ balance: 12000 });

    // assert & verify
    expect(component.unchanged()).toBe(true);
    component.form.patchValue({ balance: 12000.004 });
    expect(component.unchanged()).toBe(true);
    component.form.patchValue({ balance: 12000.01 });
    expect(component.unchanged()).toBe(false);
  });
});
