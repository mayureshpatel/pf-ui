import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  InputSignal,
  Signal,
} from '@angular/core';
import { CommonModule, formatCurrency } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

import { Transaction } from '@models/transaction.model';
import { ReportsDataService } from '../../services/reports-data.service';
import { CategoryReportData, DateRange } from '../../models/reports.model';
import { getCategoryColor } from '@shared/utils/category.utils';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { downloadCsv, toCsv } from '@shared/utils/csv.utils';

/**
 * Sub-report component for analyzing spending by category.
 *
 * Provides a horizontal bar chart of the top 10 categories and a detailed
 * breakdown table showing transaction volume and averages.
 */
@Component({
  selector: 'app-category-report',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, TableModule, ButtonModule, FormatCurrencyPipe],
  templateUrl: './category-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryReportComponent {
  private readonly dataService: ReportsDataService = inject(ReportsDataService);

  /** The dataset of transactions to analyze. */
  readonly transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();

  /** The currently selected reporting date range, used to name the CSV export (PF-306). */
  readonly dateRange: InputSignal<DateRange> = input.required<DateRange>();

  /** Aggregated report data calculated reactively from transactions. */
  readonly categoryData: Signal<CategoryReportData[]> = computed((): CategoryReportData[] =>
    this.dataService.aggregateByCategory(this.transactions()),
  );

  /** Indicates if there is sufficient data to render visuals. */
  readonly hasData: Signal<boolean> = computed((): boolean => this.categoryData().length > 0);

  /**
   * Derived Chart.js data object.
   * Uses pure computed signal for maximum performance.
   */
  readonly chartData = computed(() => {
    const data: CategoryReportData[] = this.categoryData().slice(0, 10); // Show top 10

    return {
      labels: data.map((c: CategoryReportData): string => c.category.name),
      datasets: [
        {
          label: 'Total Spent',
          data: data.map((c: CategoryReportData): number => c.total),
          backgroundColor: data.map(
            (c: CategoryReportData): string =>
              c.category.color || getCategoryColor(c.category.name),
          ),
          borderRadius: 8,
          barThickness: 32,
          hoverBackgroundColor: data.map(
            (c: CategoryReportData): string =>
              c.category.color || getCategoryColor(c.category.name),
          ),
        },
      ],
    };
  });

  /**
   * Static chart options configuration.
   */
  readonly chartOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13, family: 'monospace' },
        usePointStyle: true,
        callbacks: {
          label: (context: any): string => {
            const val: any = context.parsed.x || 0;
            return ` Total Spent: ${formatCurrency(val, 'en-US', '$', '1.2-2')}`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)', drawBorder: false },
        ticks: {
          color: '#94a3b8',
          font: { size: 11, family: 'monospace' },
          callback: (val: any): string => `$${val >= 1000 ? val / 1000 + 'k' : val}`,
        },
      },
      y: {
        grid: { display: false, drawBorder: false },
        ticks: {
          color: '#64748b',
          font: { size: 12, weight: '700' },
        },
      },
    },
  };

  /**
   * CSV rows for the current category breakdown (PF-306): a header row followed by one row per
   * category, built from the same `categoryData()` used everywhere else in this component --
   * already the full, unfiltered breakdown for the selected date range (the chart's own top-10
   * slice is a local view, not a truncation of this signal), so there's no need to round-trip to
   * the server for data already in hand.
   */
  readonly csvRows: Signal<string[][]> = computed((): string[][] => [
    ['Category', 'Total', 'Transaction Count', 'Avg / Txn'],
    ...this.categoryData().map((c: CategoryReportData): string[] => [
      c.category.name,
      c.total.toFixed(2),
      c.count.toString(),
      c.avgTransaction.toFixed(2),
    ]),
  ]);

  /**
   * Exports `csvRows()` as a downloaded CSV file, named for the current report and date range.
   */
  exportCsv(): void {
    const range: DateRange = this.dateRange();
    const filename = `category-report_${range.startDate}_to_${range.endDate}.csv`;
    downloadCsv(filename, toCsv(this.csvRows()));
  }
}
