import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { ExploreTrend, Measure, TrendBucket } from '../../models/reports.model';
import { fromLocalDateString } from '@shared/utils/transaction.utils';
import {
  bucketLabel,
  formatMeasure,
  Granularity,
  MEASURE_BAR_CLASS,
  MEASURE_LABELS,
  trendGranularity,
} from '../../utils/explore-helpers';

interface Bar {
  bucket: TrendBucket;
  label: string;
  /** The short text under the bar, or '' when this bar is skipped to keep the row readable. */
  tick: string;
  /** The year, shown under the first bar and each January so a long range stays readable. */
  tickYear: string;
  value: string;
  comparisonValue: string | null;
  /** The period the comparison outline stands for, such as "Feb 2025". */
  comparisonLabel: string | null;
  /** Height as a percentage of the plot (the whole range, below zero included). */
  height: number;
  /** Where the bar's lower edge sits, as a percentage of the plot's height. */
  bottom: number;
  comparisonHeight: number | null;
  comparisonBottom: number | null;
  negative: boolean;
  /** The period has no figure at all (not even zero); drawn as a dotted marker, not as 0. */
  noData: boolean;
  ariaLabel: string;
  /** The line shown under the chart while the bar is focused, hovered or armed. */
  readout: string;
}

/**
 * The measure over time as plain CSS bars (no chart library): one button per bucket, the comparison
 * period as a lighter outline behind it, the bucket still in progress striped, and a visually hidden
 * table saying the same thing for screen readers. Clicking a bar emits its bucket.
 */
@Component({
  selector: 'app-trend-chart',
  standalone: true,
  templateUrl: './trend-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrendChartComponent {
  readonly trend: InputSignal<ExploreTrend | null> = input.required<ExploreTrend | null>();
  readonly measure: InputSignal<Measure> = input.required<Measure>();
  readonly loading: InputSignal<boolean> = input.required<boolean>();
  /** Drop empty buckets from the start (for "All time", which begins long before the first transaction). */
  readonly trimEmpty: InputSignal<boolean> = input(false);
  readonly selectBucket: OutputEmitterRef<TrendBucket> = output<TrendBucket>();

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  /** The bar that is the tab stop (the others are reached with the arrow keys). */
  private readonly stop: WritableSignal<number> = signal(0);
  /** The bar the readout shows: the last one focused, hovered or tapped. */
  protected readonly active: WritableSignal<number | null> = signal(null);
  /** On a touch screen the first tap shows the value and the second opens the bar. */
  private readonly armed: WritableSignal<number | null> = signal(null);
  private readonly coarsePointer: boolean =
    typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

  protected readonly measureLabel: Signal<string> = computed(
    (): string => MEASURE_LABELS[this.measure()],
  );
  protected readonly barClass: Signal<string> = computed(
    (): string => MEASURE_BAR_CLASS[this.measure()],
  );
  protected readonly hasComparison: Signal<boolean> = computed(
    (): boolean => (this.trend()?.comparison.length ?? 0) > 0,
  );
  protected readonly granularity: Signal<Granularity> = computed((): Granularity =>
    trendGranularity(this.trend()),
  );

  protected readonly bars: Signal<Bar[]> = computed((): Bar[] => {
    const trend: ExploreTrend | null = this.trend();
    if (!trend) return [];
    const first: number = this.trimEmpty()
      ? Math.max(
          0,
          trend.current.findIndex((b: TrendBucket) => b.value !== null && b.value !== 0),
        )
      : 0;
    const current: TrendBucket[] = trend.current.slice(first);
    const comparison: TrendBucket[] = trend.comparison.slice(first);
    const measure: Measure = this.measure();
    const granularity: Granularity = this.granularity();
    const values: number[] = [...current, ...comparison].map((b: TrendBucket) => b.value ?? 0);
    const above: number = Math.max(...values, 0);
    const below: number = Math.abs(Math.min(...values, 0));
    const range: number = above + below;
    // a real zero line: positive bars stand on it and negative ones hang from it
    const zero: number = range === 0 ? 0 : (below / range) * 100;
    const height = (value: number | null): number =>
      range === 0 ? 0 : (Math.abs(value ?? 0) / range) * 100;
    const bottom = (value: number | null): number =>
      (value ?? 0) < 0 ? zero - height(value) : zero;
    const step: number = current.length <= 12 ? 1 : Math.ceil(current.length / 8);

    return current.map((bucket: TrendBucket, i: number): Bar => {
      const earlier: TrendBucket | undefined = comparison[i];
      const label: string = bucketLabel(bucket.start, granularity);
      const noData: boolean = bucket.value === null;
      const value: string = noData
        ? bucket.partial
          ? 'no data yet'
          : 'no data'
        : formatMeasure(measure, bucket.value);
      const comparisonValue: string | null = earlier ? formatMeasure(measure, earlier.value) : null;
      const comparisonLabel: string | null = earlier
        ? bucketLabel(earlier.start, granularity)
        : null;
      const partial: string = bucket.partial && !noData ? ', in progress' : '';
      const date: Date = fromLocalDateString(bucket.start);
      return {
        bucket,
        label,
        tick: i % step === 0 ? tickText(date, granularity) : '',
        tickYear:
          granularity !== 'day' || i === 0
            ? i === 0 || (date.getMonth() === 0 && date.getDate() <= 7)
              ? String(date.getFullYear())
              : ''
            : '',
        value,
        comparisonValue,
        comparisonLabel,
        height: height(bucket.value),
        bottom: bottom(bucket.value),
        comparisonHeight: earlier ? height(earlier.value) : null,
        comparisonBottom: earlier ? bottom(earlier.value) : null,
        negative: (bucket.value ?? 0) < 0,
        noData,
        ariaLabel: `${label}: ${value}${partial}`,
        readout: `${label}: ${value}${partial}${
          comparisonValue !== null ? `. ${comparisonLabel}: ${comparisonValue}` : ''
        }`,
      };
    });
  });

  /** Where the zero line sits, as a percentage of the plot's height, when the bars include negatives. */
  protected readonly hasNegative: Signal<boolean> = computed((): boolean =>
    this.bars().some((b: Bar): boolean => b.negative),
  );
  protected readonly zeroLine: Signal<number> = computed((): number => {
    const first: Bar | undefined = this.bars().find((b: Bar): boolean => !b.noData);
    return first ? first.bottom + (first.negative ? first.height : 0) : 0;
  });
  /** The largest figure the plot reaches, written out so the bars can be read against a number. */
  protected readonly scaleTop: Signal<string> = computed((): string => {
    const trend: ExploreTrend | null = this.trend();
    if (!trend) return '';
    const values: number[] = [...trend.current, ...trend.comparison].map(
      (b: TrendBucket): number => b.value ?? 0,
    );
    return formatMeasure(this.measure(), Math.max(...values, 0));
  });
  protected readonly scaleBottom: Signal<string> = computed((): string => {
    const trend: ExploreTrend | null = this.trend();
    if (!trend) return '';
    const values: number[] = [...trend.current, ...trend.comparison].map(
      (b: TrendBucket): number => b.value ?? 0,
    );
    return formatMeasure(this.measure(), Math.min(...values, 0));
  });
  /** What the readout line says: the bar in focus, or a hint to point at one. */
  protected readonly readoutText: Signal<string> = computed((): string => {
    const bar: Bar | undefined = this.bars()[this.active() ?? -1];
    return bar ? bar.readout : '';
  });
  protected readonly armedHint: Signal<boolean> = computed(
    (): boolean => this.coarsePointer && this.armed() !== null && this.armed() === this.active(),
  );

  /** The tab stop, kept inside the bars that exist now. */
  protected readonly tabStop: Signal<number> = computed((): number =>
    Math.min(this.stop(), Math.max(0, this.bars().length - 1)),
  );

  /** Remembers the focused bar, so tabbing back in returns to it. */
  protected onBarFocus(index: number): void {
    this.stop.set(index);
    this.active.set(index);
  }

  protected onBarHover(index: number): void {
    this.active.set(index);
  }

  /** A click opens the bar; on a touch screen the first tap only shows its value. */
  protected onBarClick(index: number, bucket: TrendBucket): void {
    if (this.coarsePointer && this.armed() !== index) {
      this.armed.set(index);
      this.active.set(index);
      return;
    }
    this.armed.set(null);
    this.selectBucket.emit(bucket);
  }

  /** Arrow keys, Home and End move between the bars, which are a single tab stop. */
  protected onBarKeydown(event: KeyboardEvent, index: number): void {
    const last: number = this.bars().length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(index + 1, last);
        break;
      case 'ArrowLeft':
        next = Math.max(index - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.stop.set(next);
    this.host.nativeElement.querySelectorAll<HTMLElement>('button[data-bar]')[next]?.focus();
  }
}

/** The short label under a bar: the month, the day of the month, or the week's start. */
function tickText(date: Date, granularity: Granularity): string {
  switch (granularity) {
    case 'day':
      return String(date.getDate());
    case 'week':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    default:
      return date.toLocaleDateString('en-US', { month: 'short' });
  }
}
