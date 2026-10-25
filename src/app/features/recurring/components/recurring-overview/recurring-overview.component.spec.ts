import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecurringFrequency, RecurringTransaction } from '@models/recurring.model';
import { RecurringOverviewComponent } from './recurring-overview.component';

const YEAR = new Date().getFullYear();

const item = (
  id: number,
  name: string,
  nextDate: string,
  over: Partial<RecurringTransaction> = {},
): RecurringTransaction =>
  ({
    id,
    merchant: { id, name },
    amount: 10,
    frequency: 'MONTHLY' as RecurringFrequency,
    nextDate,
    active: true,
    ...over,
  }) as RecurringTransaction;

describe('RecurringOverviewComponent', () => {
  let fixture: ComponentFixture<RecurringOverviewComponent>;
  let component: RecurringOverviewComponent;

  function render(
    over: Partial<{
      monthly: number;
      yearly: number;
      services: number;
      comingUp: RecurringTransaction[];
      priceChanges: RecurringTransaction[];
      patternCount: number;
    }> = {},
  ): void {
    fixture.componentRef.setInput('totals', {
      monthly: over.monthly ?? 489.55,
      yearly: over.yearly ?? 5874.6,
      services: over.services ?? 6,
    });
    fixture.componentRef.setInput('comingUp', over.comingUp ?? []);
    fixture.componentRef.setInput('priceChanges', over.priceChanges ?? []);
    fixture.componentRef.setInput('patternCount', over.patternCount ?? 0);
    fixture.detectChanges();
  }
  const text = (): string => (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => (b.textContent ?? '').trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecurringOverviewComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(RecurringOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should show the monthly, yearly and service figures', () => {
    // act
    render();

    // assert & verify
    expect(text()).toContain('You pay about $489.55 / month');
    expect(text()).toContain('$5,874.60 a year, across 6 services');
  });

  it('should say 1 service in the singular', () => {
    // act
    render({ services: 1 });

    // assert & verify
    expect(text()).toContain('across 1 service');
    expect(text()).not.toContain('across 1 services');
  });

  it('should list what is coming up with its date', () => {
    // act
    render({ comingUp: [item(1, 'Rent', `${YEAR}-11-01`), item(2, 'Netflix', `${YEAR}-11-03`)] });

    // assert & verify
    expect(text()).toContain('Coming up');
    expect(text()).toContain('Nov 1 · Rent');
    expect(text()).toContain('Nov 3 · Netflix');
  });

  it('should list each price change', () => {
    // act
    render({
      priceChanges: [
        item(1, 'Netflix', `${YEAR}-11-03`, {
          priceChange: { previousAmount: 10, newAmount: 12, since: `${YEAR}-09-03` },
        }),
      ],
    });

    // assert & verify
    expect(text()).toContain('Netflix: $10.00 to $12.00');
  });

  it('should show Review patterns only when patterns were found', () => {
    // act
    render({ patternCount: 0 });

    // assert & verify
    expect(button('Review patterns')).toBeUndefined();

    // act
    render({ patternCount: 3 });

    // assert & verify
    expect(button('Review patterns')).toBeDefined();
  });

  it('should say nothing is tracked yet at zero services', () => {
    // act
    render({ services: 0, monthly: 0, yearly: 0 });

    // assert & verify
    expect(text()).toContain('Nothing tracked yet.');
    expect(text()).not.toContain('You pay about');
  });

  it('should emit add and reviewPatterns', () => {
    // arrange
    const events: string[] = [];
    component.add.subscribe(() => events.push('add'));
    component.reviewPatterns.subscribe(() => events.push('review'));
    render({ patternCount: 2 });

    // act
    button('Add recurring')?.click();
    button('Review patterns')?.click();

    // assert & verify
    expect(events).toEqual(['add', 'review']);
  });
});
