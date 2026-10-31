import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Params } from '@angular/router';
import { NetWorthGroup } from '../../models/reports.model';
import { defaultNetWorthState } from '../../utils/net-worth-state';
import { NetWorthStoryComponent } from './net-worth-story.component';

const ally = (story: NetWorthGroup['story']): NetWorthGroup => ({
  key: '9',
  label: 'Ally High Yield',
  kind: 'ASSET',
  typeCode: 'SAVINGS',
  accountCount: 1,
  balance: 30000,
  previousBalance: 27990,
  comparisonBalance: null,
  series: [27990, 30000],
  story,
});

describe('NetWorthStoryComponent (PF-887)', () => {
  let fixture: ComponentFixture<NetWorthStoryComponent>;
  let component: NetWorthStoryComponent;
  let explorer: Params[];
  let accounts: number[];

  function render(group: NetWorthGroup): void {
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('state', defaultNetWorthState(new Date(2026, 9, 25)));
    fixture.detectChanges();
  }
  const text = (): string => (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ');
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').trim() === name,
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NetWorthStoryComponent] });
    fixture = TestBed.createComponent(NetWorthStoryComponent);
    component = fixture.componentInstance;
    explorer = [];
    accounts = [];
    component.openExplorer.subscribe((q: Params) => explorer.push(q));
    component.openAccounts.subscribe((id: number) => accounts.push(id));
  });

  const story = {
    openingBalance: 27990,
    closingBalance: 30000,
    deposits: 9200,
    withdrawals: 7800,
    interestAndAdjustments: 610,
  };

  it('should show the balance now and before, and deposits, withdrawals and interest and adjustments', () => {
    // act
    render(ally(story));

    // assert & verify
    expect(text()).toContain('Ally High Yield');
    expect(text()).toContain('Balance now $30,000, from $27,990');
    expect(text()).toContain('Deposits $9,200');
    expect(text()).toContain('Withdrawals $7,800');
    expect(text()).toContain('Interest and adjustments +$610');
  });

  it('should show a negative interest and adjustments figure with a minus sign', () => {
    // act
    render(ally({ ...story, interestAndAdjustments: -45 }));

    // assert & verify
    expect(text()).toContain('Interest and adjustments -$45');
  });

  it('should emit the explorer query and the account id from the two links', () => {
    // arrange
    render(ally(story));

    // act
    button("Open this account's transactions in the explorer")?.click();
    button('Open in Accounts')?.click();

    // assert & verify
    expect(explorer).toHaveLength(1);
    expect(explorer[0]['accountIds']).toBe('9');
    expect(explorer[0]['startDate']).toBe('2025-10-26');
    expect(accounts).toEqual([9]);
  });

  it('should state when an account has no activity in the range', () => {
    // act
    render(
      ally({
        openingBalance: 100,
        closingBalance: 100,
        deposits: 0,
        withdrawals: 0,
        interestAndAdjustments: 0,
      }),
    );

    // assert & verify
    expect(text()).toContain('No activity in this range');
  });

  it('should still offer the links when the account has no story', () => {
    // act
    render(ally(null));

    // assert & verify
    expect(button('Open in Accounts')).toBeTruthy();
    expect(text()).not.toContain('Deposits');
  });
});
