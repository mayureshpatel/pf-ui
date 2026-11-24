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
import type { ChartData, ChartOptions, LegendItem } from 'chart.js';
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
const COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const DIMMED_ALPHA = '55'; // appended to the palette's 6-digit hex colours
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
  /** True when a comparison is chosen; the chart shows the range only, so it says where the comparison is. */
  readonly comparing: InputSignal<boolean> = input<boolean>(false);

  private readonly theme: ThemeService = inject(ThemeService);

  /** Assets share the income color and debts the expense color, as on the Dashboard chart. */
  private readonly palette: Signal<ChartPalette> = computed((): ChartPalette =>
    this.theme.isDarkMode() ? CHART_PALETTE.dark : CHART_PALETTE.light,
  );

  protected readonly dollars = (value: number): string => DOLLARS.format(value);

  /** Hatched fill for debts, so they differ from assets by more than hue. */
  private debtFill(color: string): string | CanvasPattern {
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!ctx) return color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, 8, 8);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, 10);
    ctx.lineTo(10, -2);
    ctx.stroke();
    return ctx.createPattern(canvas, 'repeat') ?? color;
  }

  /** The selected month keeps full colour while the others fade; with none chosen, the last is selected. */
  private readonly selectedIndex: Signal<number> = computed((): number => {
    const index: number = this.monthOptions().findIndex(
      (o: MonthOption) => o.value === this.selectedMonth(),
    );
    return index < 0 ? this.monthOptions().length - 1 : index;
  });

  protected readonly chartData: Signal<ChartData<'bar' | 'line'>> = computed(() => {
    const data = buildChartData(this.points(), this.measure());
    const palette = this.palette();
    const selected: number = this.selectedIndex();
    const fade = (color: string): string[] =>
      data.labels.map((_: string, i: number): string =>
        i === selected ? color : color + DIMMED_ALPHA,
      );
    const datasets: ChartData<'bar' | 'line'>['datasets'] = [];
    if (data.assets.length) {
      datasets.push({
        type: 'bar',
        label: 'Assets',
        data: data.assets,
        backgroundColor: fade(palette.income),
        stack: 'balances',
      });
    }
    if (data.debts.length) {
      const solid: string | CanvasPattern = this.debtFill(palette.expense);
      datasets.push({
        type: 'bar',
        label: 'Debts (below zero)',
        data: data.debts,
        backgroundColor: data.labels.map((_: string, i: number): string | CanvasPattern =>
          i === selected ? solid : this.debtFill(palette.expense + DIMMED_ALPHA),
        ) as never,
        borderColor: data.labels.map((_: string, i: number): string =>
          i === selected ? palette.expense : palette.expense + DIMMED_ALPHA,
        ),
        borderWidth: 1,
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
        pointRadius: data.labels.map((_: string, i: number): number => (i === selected ? 6 : 3)),
      });
    }
    return { labels: data.labels, datasets };
  });

  /** Chart configuration, recomputed when the theme changes. */
  protected readonly chartOptions: Signal<ChartOptions> = computed((): ChartOptions => {
    const palette = this.palette();
    const points: NetWorthPoint[] = this.points();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: palette.legend,
            boxWidth: 14,
            padding: 14,
            font: { size: 13 },
            generateLabels: (chart): LegendItem[] =>
              chart.data.datasets.map((dataset, i: number): LegendItem => {
                const debts: boolean = String(dataset.label).startsWith('Debts');
                return {
                  text: String(dataset.label),
                  fillStyle: debts
                    ? this.debtFill(palette.expense)
                    : dataset.type === 'line'
                      ? palette.legend
                      : palette.income,
                  strokeStyle: debts ? palette.expense : palette.legend,
                  lineWidth: debts ? 1 : 0,
                  fontColor: palette.legend,
                  hidden: !chart.isDatasetVisible(i),
                  datasetIndex: i,
                };
              }),
          },
        },
        tooltip: {
          callbacks: {
            label: (item): string => {
              const value = Number(item.raw);
              const name: string = String(item.dataset.label).replace(' (below zero)', '');
              return `${name}: ${DOLLARS.format(name === 'Debts' ? Math.abs(value) : value)}`;
            },
            footer: (items): string => {
              const point: NetWorthPoint | undefined = points[items[0]?.dataIndex ?? -1];
              return point && point.assets === 0 && point.debts === 0
                ? 'No balances yet: your accounts start later'
                : '';
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: palette.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
          grid: { display: false },
        },
        y: {
          stacked: true,
          ticks: {
            color: palette.text,
            callback: (value: string | number): string => COMPACT.format(Number(value)),
          },
          grid: {
            color: (ctx): string => (ctx.tick.value === 0 ? palette.text : palette.grid),
            lineWidth: (ctx): number => (ctx.tick.value === 0 ? 2 : 1),
          },
        },
      },
    };
  });

  protected readonly title: Signal<string> = computed((): string => {
    const measure: NetWorthMeasure = this.measure();
    return measure === 'ASSETS'
      ? 'Month-end assets'
      : measure === 'DEBTS'
        ? 'Month-end debts'
        : 'Month-end net worth';
  });

  /** One sentence for the canvas's accessible name. */
  protected readonly summary: Signal<string> = computed((): string => {
    const points: NetWorthPoint[] = this.points();
    const options: MonthOption[] = this.monthOptions();
    if (points.length === 0) return '';
    const last: NetWorthPoint = points[points.length - 1];
    const value: number =
      this.measure() === 'ASSETS'
        ? last.assets
        : this.measure() === 'DEBTS'
          ? last.debts
          : last.netWorth;
    return `${this.title()}, ${options[0].label} to ${options[options.length - 1].label}: ${DOLLARS.format(value)} at the end. The table below has every month.`;
  });

  /** Where balances begin when the range starts with $0 months, else null. */
  protected readonly startNote: Signal<string | null> = computed((): string | null => {
    const points: NetWorthPoint[] = this.points();
    const index: number = points.findIndex(
      (p: NetWorthPoint) => p.assets !== 0 || p.debts !== 0 || p.netWorth !== 0,
    );
    if (index <= 0) return null;
    return `Balances start in ${this.monthOptions()[index].label}; earlier months show $0.`;
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
