import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Account, AccountSnapshot, AccountType, BankName } from '@models/account.model';
import { AccountSummaryViewComponent } from './account-summary-view.component';

const account = (over: Partial<Account> = {}): Account =>
  ({
    id: 1,
    name: 'Checking',
    currentBalance: 4820.15,
    bank: BankName.SYNOVUS,
    currency: { code: 'USD' },
    type: { label: 'Checking account', isAsset: true } as AccountType,
    ...over,
  }) as unknown as Account;

describe('AccountSummaryViewComponent', () => {
  let fixture: ComponentFixture<AccountSummaryViewComponent>;
  let component: AccountSummaryViewComponent;
  const render = (a: Account): void => {
    fixture.componentRef.setInput('account', a);
    fixture.detectChanges();
  };
  const text = (id: string): string =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`).textContent.trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountSummaryViewComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountSummaryViewComponent);
    component = fixture.componentInstance;
  });

  it('should show the bank, type and a large balance', () => {
    // act
    render(account());

    // assert & verify
    expect(text('subtitle')).toBe('Synovus, Checking account');
    expect(text('balance')).toContain('$4,820.15');
  });

  it('should show just the type when the account has no bank, and a minus sign for a negative balance', () => {
    // act
    render(account({ bank: null as never, currentBalance: -1240.33 }));

    // assert & verify
    expect(text('subtitle')).toBe('Checking account');
    expect(text('balance')).toContain('-$1,240.33');
  });

  it('should emit from each of the four actions', () => {
    // arrange
    render(account());
    const spies = { rec: vi.fn(), view: vi.fn(), edit: vi.fn(), del: vi.fn() };
    component.reconcile.subscribe(spies.rec);
    component.viewTransactions.subscribe(spies.view);
    component.edit.subscribe(spies.edit);
    component.delete.subscribe(spies.del);

    // act
    button('Reconcile with statement')?.click();
    button('View transactions')?.click();
    button('Edit details')?.click();
    button('Delete account')?.click();

    // assert & verify
    for (const spy of Object.values(spies)) expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('hand-entered (MANUAL) account', () => {
    const manual = (over: Partial<Account> = {}): Account =>
      account({
        name: 'Roth IRA',
        currentBalance: 12000,
        balanceMode: 'MANUAL',
        moneyIn: 10000,
        gain: 2000,
        type: { code: 'INVESTMENT', label: 'Investment', isAsset: true } as AccountType,
        ...over,
      });
    const label = (id: string): string =>
      fixture.nativeElement.querySelector(`[data-testid="${id}"]`)?.textContent.trim();

    it('should show Market value, Your money in and Gain', () => {
      // act
      render(manual());

      // assert & verify
      expect(label('balance-label')).toBe('Market value');
      expect(text('balance')).toContain('$12,000.00');
      expect(label('money-in-label')).toBe('Your money in');
      expect(text('money-in')).toContain('$10,000.00');
      expect(label('gain-label')).toBe('Gain');
      expect(text('gain')).toContain('+$2,000.00');
    });

    it('should show a negative gain in rose with a minus sign', () => {
      // act
      render(manual({ gain: -350.5 }));

      // assert & verify
      expect(text('gain')).toContain('-$350.50');
      expect(fixture.nativeElement.querySelector('[data-testid="gain"]').className).toContain(
        'text-rose-700',
      );
    });

    it('should show a dash for money in and gain when they are not known yet', () => {
      // act
      render(manual({ moneyIn: null, gain: null }));

      // assert & verify
      expect(text('money-in')).toBe('—');
      expect(text('gain')).toBe('—');
    });

    it('should show dashes when money in and gain are undefined', () => {
      // act
      render(manual({ moneyIn: undefined as never, gain: undefined as never }));

      // assert & verify
      expect(text('money-in')).toBe('—');
      expect(text('gain')).toBe('—');
    });

    it('should show a gain of exactly zero as a plain amount, with no sign or colour', () => {
      // act
      render(manual({ gain: 0 }));

      // assert & verify
      const gain = fixture.nativeElement.querySelector('[data-testid="gain"]');
      expect(gain.textContent.trim()).toBe('$0.00');
      expect(gain.className).not.toContain('text-rose');
      expect(gain.className).not.toContain('text-emerald');
    });

    it('should offer Update balance, not Reconcile with statement, and emit updateBalance', () => {
      // arrange
      render(manual());
      const update = vi.fn();
      const reconcile = vi.fn();
      component.updateBalance.subscribe(update);
      component.reconcile.subscribe(reconcile);

      // act
      button('Update balance')?.click();

      // assert & verify
      expect(button('Reconcile with statement')).toBeUndefined();
      expect(update).toHaveBeenCalledTimes(1);
      expect(reconcile).not.toHaveBeenCalled();
    });

    it('should show only the remaining balance for a loan', () => {
      // act
      render(
        manual({
          currentBalance: 18000,
          moneyIn: null,
          gain: null,
          type: { code: 'LOAN', label: 'Loan', isAsset: false } as AccountType,
        }),
      );

      // assert & verify
      expect(label('balance-label')).toBe('Remaining balance');
      expect(text('balance')).toContain('$18,000.00');
      expect(fixture.nativeElement.querySelector('[data-testid="money-in"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="gain"]')).toBeNull();
      expect(button('Update balance')).toBeDefined();
    });

    it('should list the balance history, newest first', () => {
      // arrange
      fixture.componentRef.setInput('history', [
        { id: 2, snapshotDate: '2026-11-01', balance: 12000 },
        { id: 1, snapshotDate: '2026-10-01', balance: 11000 },
      ] as AccountSnapshot[]);

      // act
      render(manual());

      // assert & verify
      expect(fixture.nativeElement.querySelectorAll('[data-testid="history-row"]').length).toBe(2);
    });

    it('should not show the history or the money-in rows on a derived account', () => {
      // act
      render(account());

      // assert & verify
      expect(fixture.nativeElement.querySelector('app-account-balance-history')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="money-in"]')).toBeNull();
      expect(button('Reconcile with statement')).toBeDefined();
      expect(button('Update balance')).toBeUndefined();
    });
  });
});
