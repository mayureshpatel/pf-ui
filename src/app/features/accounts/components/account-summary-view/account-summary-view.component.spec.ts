import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Account, AccountType, BankName } from '@models/account.model';
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
});
