import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Account, AccountType, BankName } from '@models/account.model';
import { groupAccounts } from '../../utils/account-totals';
import { AccountListComponent } from './account-list.component';

const t = (isAsset: boolean): AccountType => ({
  code: 'X',
  label: 'Checking account',
  isAsset,
  sortOrder: 1,
  isActive: true,
  icon: 'pi-wallet',
  color: 'text-emerald-600',
});
const acct = (
  id: number,
  name: string,
  balance: number,
  isAsset: boolean,
  bank: BankName | null = BankName.SYNOVUS,
): Account =>
  ({ id, name, currentBalance: balance, type: t(isAsset), bank, version: 1 }) as unknown as Account;

describe('AccountListComponent', () => {
  let fixture: ComponentFixture<AccountListComponent>;
  let component: AccountListComponent;
  const accounts = [
    acct(1, 'Checking', 4820.15, true),
    acct(3, 'Venture card', -1240.33, false, BankName.CAPITAL_ONE),
  ];

  function render(
    over: { selectedId?: number | null; loading?: boolean; list?: Account[] } = {},
  ): void {
    fixture.componentRef.setInput('groups', groupAccounts(over.list ?? accounts));
    fixture.componentRef.setInput('selectedId', over.selectedId ?? null);
    fixture.componentRef.setInput('loading', over.loading ?? false);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccountListComponent] }).compileComponents();
    fixture = TestBed.createComponent(AccountListComponent);
    component = fixture.componentInstance;
  });

  it('should show Assets and Liabilities headings with their subtotals', () => {
    // act
    render();

    // assert & verify
    const headings = all('[data-testid="group-heading"]').map((h) =>
      h.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(headings[0]).toContain('Assets');
    expect(headings[0]).toContain('$4,820.15');
    expect(headings[1]).toContain('Liabilities');
    expect(headings[1]).toContain('-$1,240.33');
  });

  it('should show each account with its bank and balance, liabilities with a minus sign', () => {
    // act
    render();

    // assert & verify
    const rows = all('[data-testid="open-account"]');
    expect(rows[0].textContent).toContain('Checking');
    expect(rows[0].textContent).toContain('Synovus');
    expect(rows[0].textContent).toContain('$4,820.15');
    expect(rows[1].textContent).toContain('Capital One');
    expect(rows[1].textContent).toContain('-$1,240.33');
  });

  it('should emit the account when a row is opened', () => {
    // arrange
    render();
    const opened = vi.fn();
    component.openAccount.subscribe(opened);

    // act
    all<HTMLButtonElement>('[data-testid="open-account"]')[1].click();

    // assert & verify
    expect(opened).toHaveBeenCalledWith(accounts[1]);
  });

  it('should give every row a separate, named menu button', () => {
    // act
    render();

    // assert & verify
    const menus = all<HTMLButtonElement>('[data-testid="account-menu"]');
    expect(menus.length).toBe(2);
    expect(menus[0].getAttribute('aria-label')).toBe('Actions for Checking');
    expect(menus[0].getAttribute('aria-haspopup')).toBe('menu');
  });

  it('should offer View transactions, Reconcile, Edit and Delete, each emitting its output', () => {
    // arrange
    render();
    const events = { view: vi.fn(), rec: vi.fn(), edit: vi.fn(), del: vi.fn() };
    component.viewTransactions.subscribe(events.view);
    component.reconcileAccount.subscribe(events.rec);
    component.editAccount.subscribe(events.edit);
    component.deleteAccount.subscribe(events.del);

    // act
    const items = component.menuItemsFor(accounts[0]);
    items.forEach((item) => item.command?.({} as never));

    // assert & verify
    expect(items.map((i) => i.label)).toEqual(['View transactions', 'Reconcile', 'Edit', 'Delete']);
    for (const spy of Object.values(events)) expect(spy).toHaveBeenCalledWith(accounts[0]);
  });

  it('should highlight the selected account, with a dark-mode variant', () => {
    // act
    render({ selectedId: 3 });

    // assert & verify
    const rows = all('li');
    expect(rows[0].className).not.toContain('bg-primary-50');
    expect(rows[1].className).toContain('bg-primary-50');
    expect(rows[1].className).toContain('dark:bg-primary-900/30');
  });

  it('should dim the list and mark it busy while reloading', () => {
    // act
    render({ loading: true });

    // assert & verify
    const wrapper = fixture.nativeElement.firstElementChild as HTMLElement;
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
    expect(wrapper.className).toContain('opacity-60');
  });

  it('should key rows by id so two accounts with the same name both show', () => {
    // act
    render({ list: [acct(1, 'Checking', 1, true), acct(2, 'Checking', 2, true)] });

    // assert & verify
    expect(all('[data-testid="open-account"]').length).toBe(2);
  });
});
