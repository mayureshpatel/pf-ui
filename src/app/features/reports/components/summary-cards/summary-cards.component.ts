import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { Compare, ExploreResult, ExploreRow, Measure } from '../../models/reports.model';
import {
  changeText,
  formatMeasure,
  isAdditive,
  MEASURE_LABELS,
  Tone,
} from '../../utils/explore-helpers';

interface Change {
  text: string;
  tone: Tone;
}

const SHARE_OF: Partial<Record<Measure, string>> = {
  SPENDING: 'spending',
  INCOME: 'income',
  COUNT: 'transactions',
};

/**
 * Three summary cards above the results: the measure's total with its comparison, the biggest
 * increase (or the biggest group when nothing is compared), and the transaction count with the
 * average. Presentational: the host works out which row is the biggest.
 */
@Component({
  selector: 'app-summary-cards',
  standalone: true,
  templateUrl: './summary-cards.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryCardsComponent {
  readonly result: InputSignal<ExploreResult> = input.required<ExploreResult>();
  readonly measure: InputSignal<Measure> = input.required<Measure>();
  readonly compare: InputSignal<Compare> = input.required<Compare>();
  /** The row to feature: the biggest increase when comparing, else the biggest group. */
  readonly biggest: InputSignal<ExploreRow | null> = input.required<ExploreRow | null>();

  protected readonly measureLabel: Signal<string> = computed(
    (): string => MEASURE_LABELS[this.measure()],
  );
  protected readonly totalText: Signal<string> = computed((): string =>
    formatMeasure(this.measure(), this.result().total),
  );

  protected readonly totalChange: Signal<Change | null> = computed((): Change | null => {
    const result: ExploreResult = this.result();
    if (this.compare() === 'NONE' || result.comparisonTotal === null) return null;
    return changeText(result.total, result.comparisonTotal, this.measure());
  });
  protected readonly comparisonLabel: Signal<string> = computed(
    (): string => this.result().comparisonLabel ?? 'the earlier period',
  );

  protected readonly noSavingsRate: Signal<boolean> = computed(
    (): boolean => this.measure() === 'SAVINGS_RATE' && this.result().total === null,
  );

  protected readonly comparing: Signal<boolean> = computed(
    (): boolean => this.compare() !== 'NONE',
  );
  protected readonly biggestTitle: Signal<string> = computed((): string =>
    this.comparing() ? 'Biggest increase' : 'Biggest group',
  );

  /** The featured row's amount: its increase when comparing, its share of the total otherwise. */
  protected readonly biggestDetail: Signal<string> = computed((): string => {
    const row: ExploreRow | null = this.biggest();
    if (!row || row.value === null) return '';
    const measure: Measure = this.measure();
    if (this.comparing()) {
      const delta: number = row.value - (row.comparisonValue ?? 0);
      return `${delta < 0 ? '-' : '+'}${formatMeasure(measure, Math.abs(delta))}`;
    }
    const total: number | null = this.result().total;
    const noun: string | undefined = SHARE_OF[measure];
    return total && total > 0 && noun && isAdditive(measure)
      ? `${Math.round((row.value / total) * 100)}% of ${noun}`
      : formatMeasure(measure, row.value);
  });
  protected readonly biggestChange: Signal<Change | null> = computed((): Change | null => {
    const row: ExploreRow | null = this.biggest();
    return this.comparing() && row
      ? changeText(row.value, row.comparisonValue, this.measure())
      : null;
  });

  protected toneClass(tone: Tone): string {
    return tone === 'bad'
      ? 'text-amber-700 dark:text-amber-400'
      : tone === 'good'
        ? 'text-primary-700 dark:text-primary-400'
        : 'text-muted-color';
  }

  protected readonly countText: Signal<string> = computed((): string => {
    const count: number = this.result().totalCount;
    return `${count.toLocaleString('en-US')} ${count === 1 ? 'transaction' : 'transactions'}`;
  });
  protected readonly averageText: Signal<string | null> = computed((): string | null => {
    const { total, totalCount } = this.result();
    const measure: Measure = this.measure();
    if ((measure !== 'SPENDING' && measure !== 'INCOME') || total === null || totalCount === 0) {
      return null;
    }
    return formatMeasure(measure, total / totalCount);
  });
}
