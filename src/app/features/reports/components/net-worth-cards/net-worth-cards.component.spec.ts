import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  NetWorthComparison,
  NetWorthCompareMode,
  NetWorthPoint,
  NetWorthSummary,
} from '../../models/reports.model';
import { NetWorthCardsComponent } from './net-worth-cards.component';

const summary = (over: Partial<NetWorthSummary> = {}): NetWorthSummary => ({
  netWorth: 128430,
  assets: 171900,
  debts: 43470,
  liquidCash: 22600,
  averageMonthlySpending: 5512,
  monthsCovered: 4.1,
  ...over,
});
const opening: NetWorthPoint = {
  date: '2025-09-30',
  assets: 159000,
  debts: 45000,
  netWorth: 114000,
  partial: false,
};
const yearAgo: NetWorthComparison = {
  label: 'a year ago',
  start: '2025-10-01',
  end: '2025-10-31',
  netWorth: 114310,
  assets: 159000,
  debts: 47820,
};

describe('NetWorthCardsComponent (PF-887)', () => {
  let fixture: ComponentFixture<NetWorthCardsComponent>;

  function render(
    over: Partial<NetWorthSummary> = {},
    comparison: NetWorthComparison | null = null,
    compareMode: NetWorthCompareMode = 'NONE',
  ): void {
    fixture.componentRef.setInput('summary', summary(over));
    fixture.componentRef.setInput('opening', opening);
    fixture.componentRef.setInput('comparison', comparison);
    fixture.componentRef.setInput('compareMode', compareMode);
    fixture.detectChanges();
  }
  const cell = (id: string): string =>
    (fixture.nativeElement.querySelector(`[data-testid="${id}"]`)?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [NetWorthCardsComponent] });
    fixture = TestBed.createComponent(NetWorthCardsComponent);
  });

  it('should show the four figures in whole dollars', () => {
    // act
    render();

    // assert & verify
    expect(cell('card-net-worth-value')).toBe('$128,430');
    expect(cell('card-assets-value')).toBe('$171,900');
    expect(cell('card-debts-value')).toBe('$43,470');
    expect(cell('card-liquid-value')).toBe('$22,600');
  });

  it('should show the change in net worth against the start of the range when not comparing', () => {
    // act
    render();

    // assert & verify -- 128,430 - 114,000
    expect(cell('card-net-worth-change')).toBe('▲ up $14,430 (12.7%) over the range');
    expect(cell('card-assets-change')).toBe('▲ up 8.1% over the range');
  });

  it('should show the change against the comparison when there is one', () => {
    // act
    render({}, yearAgo, 'YEAR_AGO');

    // assert & verify -- 128,430 - 114,310
    expect(cell('card-net-worth-change')).toBe('▲ up $14,120 (12.4%) vs a year ago');
  });

  it('should say a debt that fell was paid down, with the amount', () => {
    // act
    render({}, yearAgo, 'YEAR_AGO');

    // assert & verify -- 47,820 - 43,470
    expect(cell('card-debts-change')).toBe('▼ down 9.1% (paid down $4,350) vs a year ago');
  });

  it('should say a debt that grew grew, with the amount', () => {
    // act
    render({ debts: 50000 }, yearAgo, 'YEAR_AGO');

    // assert & verify
    expect(cell('card-debts-change')).toBe('▲ up 4.6% (grew by $2,180) vs a year ago');
  });

  it('should say how many months liquid cash covers, or a dash when there is no spending', () => {
    // act
    render();

    // assert & verify
    expect(cell('card-liquid-change')).toBe('covers 4.1 months of spending');

    // act
    render({ monthsCovered: null });

    // assert & verify
    expect(cell('card-liquid-change')).toBe('—');
  });

  it('should keep the sign and the words when net worth is negative', () => {
    // act
    render({ netWorth: -2500, assets: 1000, debts: 3500 });

    // assert & verify
    expect(cell('card-net-worth-value')).toBe('-$2,500');
    expect(cell('card-net-worth-change')).toContain('▼ down');
  });

  it('should say no change when nothing moved', () => {
    // act
    render({ netWorth: 114000 });

    // assert & verify
    expect(cell('card-net-worth-change')).toBe('no change over the range');
  });
});
