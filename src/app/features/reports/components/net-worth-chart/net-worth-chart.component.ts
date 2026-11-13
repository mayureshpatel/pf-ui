import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { ChartModule } from 'primeng/chart';
import type { ChartData, ChartOptions } from 'chart.js';
import { ThemeService } from '@core/services/theme.service';
import { CHART_PALETTE, ChartPalette } from '@shared/utils/chart-palette';
import { NetWorthMeasure, NetWorthPoint } from '../../models/reports.model';
import { chartData as buildChartData, pointMonth } from '../../utils/net-worth-helpers';

const MONTH_NAMES: string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

interface MonthOption {
  value: string;
  label: string;
}

/**
 * Month-end net worth: assets as bars above the zero line, debts as bars below it, and net worth as a line.
 * Clicking a month, or choosing it in the labelled select (the keyboard route), asks for that month's
 * accounts. A visually hidden table carries the same numbers for screen readers.
 */
@Component({
  selector: 'app-net-worth-chart',
  standalone: true,
  imports: [ChartModule],
  templateUrl: './net-worth-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NetWorthChartComponent {
  readonly points: InputSignal<NetWorthPoint[]> = input.required<NetWorthPoint[]>();
  readonly measure: InputSignal<NetWorthMeasure> = input.required<NetWorthMeasure>();
  /** The month (yyyy-MM) whose accounts are shown, or null for the last one. */
  readonly month: InputSignal<string | null> = input.required<string | null>();
  /** Emits the month (yyyy-MM) the user picked. */
  readonly monthSelect: OutputEmitterRef<string> = output<string>();

  private readonly theme: ThemeService = inject(ThemeService);

  /** Assets share the income color and debts the expense color, as on the Dashboard chart. */
  private readonly palette: Signal<ChartPalette> = computed((): ChartPalette =>
    this.theme.isDarkMode() ? CHART_PALETTE.dark : CHART_PALETTE.light,
  );

  protected readonly dollars = (value: number): string => DOLLARS.format(value);

  protected readonly chartData: Signal<ChartData<'bar' | 'line'>> = computed(() => {
    const data = buildChartData(this.points(), this.measure());
    const palette = this.palette();
    const datasets: ChartData<'bar' | 'line'>['datasets'] = [];
    if (data.assets.length) {
      datasets.push({
        type: 'bar',
        label: 'Assets',
        data: data.assets,
        backgroundColor: palette.income,
        stack: 'balances',
      });
    }
    if (data.debts.length) {
      datasets.push({
        type: 'bar',
        label: 'Debts',
        data: data.debts,
        backgroundColor: palette.expense,
        stack: 'balances',
      });
    }
    if (data.netWorth.length) {
      datasets.push({
        type: 'line',
        label: 'Net worth',
        data: data.netWorth,
        borderColor: palette.legend,
        backgroundColor: palette.legend,
        borderWidth: 2,
        pointRadius: 3,
      });
    }
    return { labels: data.labels, datasets };
  });

  /** Chart configuration, recomputed when the theme changes. */
  protected readonly chartOptions: Signal<ChartOptions> = computed((): ChartOptions => {
    const palette = this.palette();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: palette.legend } } },
      scales: {
        x: { stacked: true, ticks: { color: palette.text }, grid: { display: false } },
        y: {
          stacked: true,
          ticks: {
            color: palette.text,
            callback: (value: string | number): string => DOLLARS.format(Number(value)),
          },
          grid: { color: palette.grid },
        },
      },
    };
  });

  protected readonly monthOptions: Signal<MonthOption[]> = computed((): MonthOption[] =>
    this.points().map((p: NetWorthPoint): MonthOption => ({
      value: pointMonth(p.date),
      label: `${MONTH_NAMES[Number(p.date.slice(5, 7)) - 1]} ${p.date.slice(0, 4)}`,
    })),
  );

  protected readonly selectedMonth: Signal<string> = computed((): string => {
    const options: MonthOption[] = this.monthOptions();
    return this.month() ?? options[options.length - 1]?.value ?? '';
  });

  /** A click on the chart: the bar's position is the point's position. */
  protected onChartSelect(event: { element?: { index: number } }): void {
    const index: number | undefined = event.element?.index;
    const option: MonthOption | undefined =
      index === undefined ? undefined : this.monthOptions()[index];
    if (option) this.monthSelect.emit(option.value);
  }

  protected onSelect(value: string): void {
    this.monthSelect.emit(value);
  }
}
