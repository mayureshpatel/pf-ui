import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import type { ChartData } from 'chart.js';
import { CashFlowTrend } from '@models/dashboard.model';
import { ThemeService } from '@core/services/theme.service';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';

/**
 * Chart colors, resolved from the design system because Chart.js cannot read CSS variables.
 * Series use primary-600 / rose-600 on light surfaces (3:1+ against white) and the 400 shades
 * on dark. Text and grid colors are the warm stone scale, never cool slate.
 */
const PALETTE = {
  light: {
    income: '#059669',
    expense: '#e11d48',
    text: '#6b655f',
    legend: '#44403c',
    grid: '#e7e5e4',
    tooltip: '#1c1917',
  },
  dark: {
    income: '#34d399',
    expense: '#fb7185',
    text: '#a8a29e',
    legend: '#d6d3d1',
    grid: '#44403c',
    tooltip: '#292524',
  },
} as const;

/** A month picked out in the chart, as the dashboard's single-month periods select one. */
export interface FocusMonth {
  /** The month, 1 to 12. */
  month: number;
  /** The four-digit year. */
  year: number;
}

/** Appended to a six-digit hex color to draw it at 40% strength. */
const DIMMED_ALPHA = '66';

/** A trend row prepared for the visible summary and the screen-reader table. */
interface TrendRow {
  month: number;
  year: number;
  label: string;
  income: number;
  expense: number;
  net: number;
}

/**
 * Component for displaying a bar chart comparison of income and expenses over time.
 *
 * Utilizes PrimeNG Chart.js integration and updates reactively based on input signals and the
 * active theme. A visible latest-month summary and a screen-reader table carry the same figures
 * so nothing depends on hovering the canvas or on telling two hues apart.
 */
@Component({
  selector: 'app-cash-flow-trend',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, FormatCurrencyPipe],
  templateUrl: './cash-flow-trend.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashFlowTrendComponent {
  /** The trend data to visualize. */
  readonly data: InputSignal<CashFlowTrend[]> = input.required<CashFlowTrend[]>();

  /**
   * The month the dashboard's period selects, when it selects a single month. Its bars stay at full
   * strength and the others are dimmed, and the summary line reports it.
   */
  readonly focus: InputSignal<FocusMonth | null> = input<FocusMonth | null>(null);

  private readonly theme: ThemeService = inject(ThemeService);

  private readonly palette = computed(() =>
    this.theme.isDarkMode() ? PALETTE.dark : PALETTE.light,
  );

  /**
   * The trend without its empty tail. The backend returns the trailing twelve months up to now, so
   * a month with no data yet would otherwise show as a column of zeros that reads as missing data.
   * Empty months between months with data stay, because there they are real gaps.
   */
  private readonly shown: Signal<CashFlowTrend[]> = computed((): CashFlowTrend[] => {
    const all: CashFlowTrend[] = this.data();
    let end: number = all.length;
    while (end > 0 && all[end - 1].income === 0 && all[end - 1].expense === 0) {
      end--;
    }
    return all.slice(0, end);
  });

  /** Month rows used by the visible summary and the screen-reader table. */
  readonly rows: Signal<TrendRow[]> = computed((): TrendRow[] =>
    this.shown().map((d: CashFlowTrend): TrendRow => ({
      month: d.month,
      year: d.year,
      label: formatDate(new Date(d.year, d.month - 1), 'MMM yy', 'en-US'),
      income: d.income,
      expense: d.expense,
      net: d.income - d.expense,
    })),
  );

  /** The span the chart covers, for example "Dec 2025 to Aug 2026", or null when it is empty. */
  private readonly span: Signal<string | null> = computed((): string | null => {
    const rows: TrendRow[] = this.rows();
    if (rows.length === 0) {
      return null;
    }
    const name = (r: TrendRow): string =>
      formatDate(new Date(r.year, r.month - 1), 'MMM y', 'en-US');
    const first: string = name(rows[0]);
    const last: string = name(rows[rows.length - 1]);
    return first === last ? first : `${first} to ${last}`;
  });

  /**
   * What the chart covers. The trailing twelve months, unless the empty tail has been trimmed, in
   * which case it names the months actually shown so the caption never promises more than the bars.
   */
  readonly scope: Signal<string> = computed((): string =>
    this.rows().length >= 12 || this.span() === null ? 'Last 12 months' : (this.span() as string),
  );

  /** The chart's text alternative. */
  readonly chartLabel: Signal<string> = computed((): string => {
    const covers: string = this.scope() === 'Last 12 months' ? 'the last 12 months' : this.scope();
    return `Bar chart of income and expenses for ${covers}. A table with the same figures follows.`;
  });

  /** The index of the selected month among the shown rows, or -1 when none is selected or shown. */
  private readonly focusIndex: Signal<number> = computed((): number => {
    const target: FocusMonth | null = this.focus();
    return target
      ? this.rows().findIndex(
          (r: TrendRow): boolean => r.month === target.month && r.year === target.year,
        )
      : -1;
  });

  /** The month the summary line reports: the selected one, else the latest with data. */
  readonly latest: Signal<TrendRow | null> = computed((): TrendRow | null => {
    const index: number = this.focusIndex();
    return index >= 0 ? this.rows()[index] : (this.rows().at(-1) ?? null);
  });

  /**
   * Derived signal that transforms the raw trend data into a format
   * compatible with Chart.js.
   */
  readonly chartData: Signal<ChartData<'bar'>> = computed(() => {
    const trendData: CashFlowTrend[] = this.shown();
    const p = this.palette();
    const selected: number = this.focusIndex();
    const paint = (color: string): string | string[] =>
      selected < 0
        ? color
        : trendData.map((_: CashFlowTrend, i: number): string =>
            i === selected ? color : color + DIMMED_ALPHA,
          );

    // Map month/year numbers to short labels (e.g., 'Jan 24')
    const labels: string[] = trendData.map((d: CashFlowTrend): string => {
      const date = new Date(d.year, d.month - 1);
      return formatDate(date, 'MMM yy', 'en-US');
    });

    return {
      labels,
      datasets: [
        {
          label: 'Income',
          backgroundColor: paint(p.income),
          borderRadius: 6,
          data: trendData.map((d: CashFlowTrend): number => d.income),
        },
        {
          label: 'Expenses',
          backgroundColor: paint(p.expense),
          borderRadius: 6,
          data: trendData.map((d: CashFlowTrend): number => d.expense),
        },
      ],
    };
  });

  /** Chart configuration, recomputed when the theme changes. */
  readonly chartOptions = computed(() => {
    const p = this.palette();
    return {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 20,
            font: { size: 12, weight: '700' },
            color: p.legend,
          },
        },
        tooltip: {
          backgroundColor: p.tooltip,
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          usePointStyle: true,
        },
      },
      scales: {
        x: {
          ticks: { color: p.text, font: { size: 12, weight: '600' } },
          grid: { display: false, drawBorder: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: p.text,
            font: { size: 12, family: 'monospace' },
            callback: (value: number): string => `$${value >= 1000 ? value / 1000 + 'k' : value}`,
          },
          grid: { color: p.grid, drawBorder: false },
        },
      },
    };
  });
}
