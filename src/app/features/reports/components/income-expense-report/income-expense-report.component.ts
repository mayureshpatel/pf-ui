import {Component, computed, inject, input, InputSignal, Signal} from '@angular/core';
import {CommonModule, formatCurrency} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ChartModule} from 'primeng/chart';
import {TableModule} from 'primeng/table';

import {Transaction} from '@models/transaction.model';
import {ReportsDataService} from '../../services/reports-data.service';
import {MonthlyReportData} from '../../models/reports.model';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

/**
 * Sub-report component for analyzing income vs. expense trends over time.
 *
 * Provides a stacked bar chart for monthly comparisons and a line chart
 * for net savings trends, accompanied by a detailed summary table.
 */
@Component({
  selector: 'app-income-expense-report',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, TableModule, FormatCurrencyPipe],
  templateUrl: './income-expense-report.component.html'
})
export class IncomeExpenseReportComponent {
  private readonly dataService: ReportsDataService = inject(ReportsDataService);

  /** The dataset of transactions to analyze. */
  readonly transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();

  /** Aggregated monthly report data calculated reactively. */
  readonly monthlyData: Signal<MonthlyReportData[]> = computed((): MonthlyReportData[] =>
    this.dataService.aggregateByMonth(this.transactions())
  );

  /** Indicates if there is sufficient data to render visuals. */
  readonly hasData: Signal<boolean> = computed(() => this.monthlyData().length > 0);

  /**
   * Derived Stacked Bar Chart data for Income vs Expense comparison.
   */
  readonly stackedBarData: Signal<any> = computed(() => {
    const data: MonthlyReportData[] = this.monthlyData();
    const labels: string[] = data.map((m: MonthlyReportData): string => this.formatMonthLabel(m.month));

    return {
      labels,
      datasets: [
        {
          label: 'Income',
          backgroundColor: '#10b981', // emerald-500
          borderRadius: 4,
          data: data.map((m: MonthlyReportData): number => m.income)
        },
        {
          label: 'Expenses',
          backgroundColor: '#f43f5e', // rose-500
          borderRadius: 4,
          data: data.map((m: MonthlyReportData): number => Math.abs(m.expense))
        }
      ]
    };
  });

  /**
   * Derived Line Chart data for Net Savings trend analysis.
   */
  readonly lineChartData: Signal<any> = computed(() => {
    const data: MonthlyReportData[] = this.monthlyData();
    const labels: string[] = data.map((m: MonthlyReportData): string => this.formatMonthLabel(m.month));

    return {
      labels,
      datasets: [{
        label: 'Net Savings',
        data: data.map((m: MonthlyReportData): number => m.netSavings),
        borderColor: '#3b82f6', // primary blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };
  });

  /**
   * Configuration for the stacked bar chart.
   */
  readonly stackedBarOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {usePointStyle: true, pointStyle: 'circle', font: {weight: 'bold'}, color: '#64748b'}
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        callbacks: {
          label: (context: any): string => ` ${context.dataset.label}: ${formatCurrency(context.parsed.y || 0, 'en-US', '$', '1.2-2')}`
        }
      }
    },
    scales: {
      x: {stacked: true, grid: {display: false}, ticks: {color: '#94a3b8', font: {size: 11, weight: '600'}}},
      y: {
        stacked: true,
        grid: {color: 'rgba(148, 163, 184, 0.1)', drawBorder: false},
        ticks: {
          color: '#94a3b8',
          font: {size: 11, family: 'monospace'},
          callback: (v: any) => `$${v >= 1000 ? (v / 1000) + 'k' : v}`
        }
      }
    }
  };

  /**
   * Configuration for the net savings line chart.
   */
  readonly lineChartOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {display: false},
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        callbacks: {
          label: (context: any): string => ` Net Savings: ${formatCurrency(context.parsed.y || 0, 'en-US', '$', '1.2-2')}`
        }
      }
    },
    scales: {
      x: {grid: {display: false}, ticks: {color: '#94a3b8', font: {size: 11, weight: '600'}}},
      y: {
        grid: {color: 'rgba(148, 163, 184, 0.1)', drawBorder: false},
        ticks: {
          color: '#94a3b8',
          font: {size: 11, family: 'monospace'},
          callback: (v: any): string => `$${v >= 1000 ? (v / 1000) + 'k' : v}`
        }
      }
    }
  };

  /**
   * Formats a YYYY-MM string into a human-readable "MMM YY" label.
   */
  private formatMonthLabel(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const date = new Date(Number.parseInt(year), Number.parseInt(month) - 1);
    return date.toLocaleDateString('en-US', {month: 'short', year: '2-digit'});
  }

  /**
   * Returns semantic color classes for savings values.
   */
  getSavingsClass(net: number): string {
    return net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  }
}
