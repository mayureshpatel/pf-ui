import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Compare, ExploreResult, ExploreRow, Measure } from '../../models/reports.model';
import { SummaryCardsComponent } from './summary-cards.component';

const result = (over: Partial<ExploreResult> = {}): ExploreResult => ({
  rows: [],
  total: 1187,
  comparisonTotal: 1000,
  totalCount: 4,
  excludedCount: 0,
  comparisonStart: '2025-01-01',
  comparisonEnd: '2025-10-25',
  comparisonLabel: 'same days last year (Jan 1 to Oct 25, 2025)',
  inProgress: true,
  ...over,
});
const food: ExploreRow = { key: '5', label: 'Food', value: 400, comparisonValue: 300, count: 12 };

describe('SummaryCardsComponent', () => {
  let fixture: ComponentFixture<SummaryCardsComponent>;

  function render(
    res: ExploreResult,
    measure: Measure = 'SPENDING',
    compare: Compare = 'SAME_DAYS_LAST_YEAR',
    biggest: ExploreRow | null = food,
  ): string {
    fixture.componentRef.setInput('result', res);
    fixture.componentRef.setInput('measure', measure);
    fixture.componentRef.setInput('compare', compare);
    fixture.componentRef.setInput('biggest', biggest);
    fixture.detectChanges();
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SummaryCardsComponent] });
    fixture = TestBed.createComponent(SummaryCardsComponent);
  });

  it('should show the comparison text with an arrow and words', () => {
    // act
    const text = render(result());

    // assert & verify
    expect(text).toContain('$1,187.00');
    expect(text).toContain('▲ up 18.7% vs same days last year (Jan 1 to Oct 25, 2025)');
  });

  it('should show Biggest increase with its amount when comparing', () => {
    // act
    const text = render(result());

    // assert & verify
    expect(text).toContain('Biggest increase');
    expect(text).toContain('Food');
    expect(text).toContain('+$100.00');
    expect(text).toContain('▲ up 33.3%');
  });

  it('should show Biggest group with its share when compare is off', () => {
    // act
    const text = render(
      result({ comparisonTotal: null, comparisonLabel: null }),
      'SPENDING',
      'NONE',
    );

    // assert & verify
    expect(text).toContain('Biggest group');
    expect(text).toContain('Food');
    expect(text).toContain('34% of spending');
    expect(text).not.toContain(' vs ');
  });

  it('should show the transaction count and the average', () => {
    // act
    const text = render(result({ total: 1000, comparisonTotal: null }), 'SPENDING', 'NONE');

    // assert & verify
    expect(text).toContain('4 transactions');
    expect(text).toContain('Average $250.00');
  });

  it('should show no average for a rate and say there is no savings rate without income', () => {
    // act
    const text = render(
      result({ total: null, comparisonTotal: null }),
      'SAVINGS_RATE',
      'NONE',
      null,
    );

    // assert & verify
    expect(text).not.toContain('Average');
    expect(text).toContain('No income in this period, so there is no savings rate.');
  });

  it('should show a dash when there is no biggest row', () => {
    // act
    const text = render(result(), 'SPENDING', 'NONE', null);

    // assert & verify
    expect(text).toContain('Biggest group');
    expect(text).toContain('—');
  });
});
