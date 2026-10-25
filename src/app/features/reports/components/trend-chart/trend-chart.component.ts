import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { ExploreTrend, Measure, TrendBucket } from '../../models/reports.model';
import {
  bucketLabel,
  formatMeasure,
  Granularity,
  granularityOf,
  MEASURE_LABELS,
} from '../../utils/explore-helpers';

interface Bar {
  bucket: TrendBucket;
  label: string;
  value: string;
  comparisonValue: string | null;
  /** Bar height as a percentage of the tallest value, current or comparison. */
  height: number;
  comparisonHeight: number | null;
  negative: boolean;
  ariaLabel: string;
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

  protected readonly measureLabel: Signal<string> = computed(
    (): string => MEASURE_LABELS[this.measure()],
  );
  protected readonly hasComparison: Signal<boolean> = computed(
    (): boolean => (this.trend()?.comparison.length ?? 0) > 0,
  );
  protected readonly granularity: Signal<Granularity> = computed((): Granularity =>
    granularityOf((this.trend()?.current ?? []).map((b: TrendBucket) => b.start)),
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
    const largest: number = Math.max(
      ...current.map((b: TrendBucket) => Math.abs(b.value ?? 0)),
      ...comparison.map((b: TrendBucket) => Math.abs(b.value ?? 0)),
      0,
    );
    const height = (value: number | null): number =>
      largest === 0 ? 0 : (Math.abs(value ?? 0) / largest) * 100;

    return current.map((bucket: TrendBucket, i: number): Bar => {
      const earlier: TrendBucket | undefined = comparison[i];
      const label: string = bucketLabel(bucket.start, granularity);
      const value: string = formatMeasure(measure, bucket.value);
      return {
        bucket,
        label,
        value,
        comparisonValue: earlier ? formatMeasure(measure, earlier.value) : null,
        height: height(bucket.value),
        comparisonHeight: earlier ? height(earlier.value) : null,
        negative: (bucket.value ?? 0) < 0,
        ariaLabel: `${label}: ${value}${bucket.partial ? ', in progress' : ''}`,
      };
    });
  });
}
