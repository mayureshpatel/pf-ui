import { vi } from 'vitest';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Account, AccountType } from '@models/account.model';
import { defaultNetWorthState, NetWorthState } from '../../utils/net-worth-state';
import { NetWorthControlsComponent } from './net-worth-controls.component';

const accounts = [
  { id: 3, name: 'Ally High Yield' },
  { id: 4, name: 'Everyday checking' },
  { id: 5, name: 'Visa' },
] as Account[];
const types = [
  { code: 'SAVINGS', label: 'Savings' },
  { code: 'CHECKING', label: 'Checking' },
] as AccountType[];

describe('NetWorthControlsComponent (PF-887)', () => {
  let fixture: ComponentFixture<NetWorthControlsComponent>;
  let component: NetWorthControlsComponent;
  let emitted: Partial<NetWorthState>[];

  function render(over: Partial<NetWorthState> = {}): void {
    fixture.componentRef.setInput('state', {
      ...defaultNetWorthState(new Date(2026, 9, 25)),
      ...over,
    });
    fixture.componentRef.setInput('accounts', accounts);
    fixture.componentRef.setInput('types', types);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (): string => (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');
  const button = (name: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find(
      (b) => (b.textContent ?? '').trim() === name || b.getAttribute('aria-label') === name,
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    TestBed.configureTestingModule({ imports: [NetWorthControlsComponent, NoopAnimationsModule] });
    fixture = TestBed.createComponent(NetWorthControlsComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.stateChange.subscribe((c: Partial<NetWorthState>) => emitted.push(c));
  });

  afterEach(() => vi.useRealTimers());

  it('should list the three measures with the current one pressed', () => {
    // act
    render({ measure: 'ASSETS' });

    // assert & verify
    expect(all('[aria-label="Measure"] button').map((b) => b.textContent?.trim())).toEqual([
      'Net worth',
      'Assets',
      'Debts',
    ]);
    expect(button('Assets')?.getAttribute('aria-pressed')).toBe('true');
    expect(button('Net worth')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('should emit only the measure when one is chosen', () => {
    // arrange
    render();

    // act
    button('Debts')?.click();

    // assert & verify
    expect(emitted).toEqual([{ measure: 'DEBTS' }]);
  });

  it('should offer the range presets, a custom range and the comparisons', () => {
    // act
    render();

    // assert & verify
    expect(component['rangeOptions'].map((o) => o.label)).toEqual([
      'This month',
      'Last month',
      'This quarter',
      'This year',
      'Last 12 months',
      'All time',
      'Custom range',
    ]);
    expect(component['compareOptions'].map((o) => o.label)).toEqual([
      'No comparison',
      'A year ago',
      'Previous period',
    ]);
  });

  it('should emit the dates, the label and a cleared month when a range preset is chosen', () => {
    // arrange
    render({ month: '2026-03' });

    // act
    component['onRange']('this-year');

    // assert & verify
    expect(emitted).toEqual([
      { startDate: '2026-01-01', endDate: '2026-12-31', rangeLabel: 'This year', month: null },
    ]);
  });

  it('should emit only the comparison when it changes', () => {
    // arrange
    render();

    // act
    component['onCompare']('YEAR_AGO');

    // assert & verify
    expect(emitted).toEqual([{ compare: 'YEAR_AGO' }]);
  });

  it('should disable Category, Merchant and Tag with the reason', () => {
    // act
    render();

    // assert & verify
    for (const name of ['Category', 'Merchant', 'Tag']) {
      const chip = button(name);
      expect(chip?.disabled).toBe(true);
      expect(chip?.getAttribute('aria-describedby')).toBe('net-worth-filter-reason');
    }
    expect(fixture.nativeElement.querySelector('#net-worth-filter-reason').textContent).toContain(
      "don't apply to balances",
    );
  });

  it('should add an account filter chip and remove it again', () => {
    // arrange
    render({ accountIds: [3] });

    // act
    component['onAddAccount'](4);
    button('Remove Ally High Yield')?.click();

    // assert & verify
    expect(text()).toContain('Ally High Yield');
    expect(emitted).toEqual([{ accountIds: [3, 4] }, { accountIds: [], accountId: null }]);
  });

  it('should clear the drilled account when its filter chip is removed', () => {
    // arrange
    render({ accountIds: [3, 4], accountId: 3 });

    // act
    button('Remove Ally High Yield')?.click();

    // assert & verify
    expect(emitted).toEqual([{ accountIds: [4], accountId: null }]);
  });

  it('should show the drilled account type as a removable chip', () => {
    // arrange
    render({ typeCode: 'SAVINGS', accountId: 3 });

    // act
    expect(text()).toContain('Account type: Savings');
    button('Remove Account type: Savings')?.click();

    // assert & verify
    expect(emitted).toEqual([{ typeCode: null, accountId: null }]);
  });
});
