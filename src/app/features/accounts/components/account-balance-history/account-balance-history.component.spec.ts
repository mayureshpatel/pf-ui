import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountSnapshot } from '@models/account.model';
import { AccountBalanceHistoryComponent } from './account-balance-history.component';

const entry = (id: number, snapshotDate: string, balance: number): AccountSnapshot =>
  ({ id, snapshotDate, balance }) as AccountSnapshot;

describe('AccountBalanceHistoryComponent', () => {
  let fixture: ComponentFixture<AccountBalanceHistoryComponent>;

  const render = (entries: AccountSnapshot[]): void => {
    fixture.componentRef.setInput('entries', entries);
    fixture.componentRef.setInput('currencyCode', 'USD');
    fixture.detectChanges();
  };
  const rows = (): string[] =>
    Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('[data-testid="history-row"]'),
    ).map((r) => r.textContent!.replace(/\s+/g, ' ').trim());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountBalanceHistoryComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountBalanceHistoryComponent);
  });

  it('should show the empty state when there are no entries', () => {
    // act
    render([]);

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('No balance entries yet');
    expect(rows().length).toBe(0);
  });

  it('should list entries newest first with date and balance', () => {
    // act
    render([
      entry(1, '2026-10-01', 11000),
      entry(3, '2026-11-11', 12500.5),
      entry(2, '2026-11-01', 12000),
    ]);

    // assert & verify
    const list = rows();
    expect(list.length).toBe(3);
    expect(list[0]).toContain('2026-11-11');
    expect(list[0]).toContain('$12,500.50');
    expect(list[1]).toContain('2026-11-01');
    expect(list[2]).toContain('2026-10-01');
    expect(fixture.nativeElement.textContent).not.toContain('No balance entries yet');
  });
});
