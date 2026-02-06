import { Component, input, computed, signal, effect, inject, WritableSignal } from '@angular/core';
import {CommonModule, formatCurrency} from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { Transaction } from '@models/transaction.model';
import { ReportsDataService } from '../../services/reports-data.service';
import { MonthlyReportData } from '../../models/reports.model';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-income-expense-report',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, TableModule, FormatCurrencyPipe],
  templateUrl: './income-expense-report.component.html'
})
export class IncomeExpenseReportComponent {
  private readonly dataService = inject(ReportsDataService);

  transactions = input.required<Transaction[]>();

  // Aggregated data
  protected monthlyData = computed(() => {
    return this.dataService.aggregateByMonth(this.transactions());
  });

  protected hasData = computed(() => this.monthlyData().length > 0);

  // Chart data
  protected stackedBarData: WritableSignal<any> = signal({});
  protected stackedBarOptions: WritableSignal<any> = signal({});
  protected lineChartData: WritableSignal<any> = signal({});
  protected lineChartOptions: WritableSignal<any> = signal({});

  constructor() {
    effect(() => {
      const monthly = this.monthlyData();
      if (monthly.length > 0) {
        this.updateStackedBarChart(monthly);
        this.updateLineChart(monthly);
      }
    });
    this.initChartOptions();
  }

  private updateStackedBarChart(monthlyData: MonthlyReportData[]): void {
    const labels = monthlyData.map(m => {
      const [year, month] = m.month.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    this.stackedBarData.set({
      labels,
      datasets: [
        {
          label: 'Income',
          backgroundColor: '#10B981',
          data: monthlyData.map(m => m.income)
        },
        {
          label: 'Expenses',
          backgroundColor: '#EF4444',
          data: monthlyData.map(m => Math.abs(m.expense))
        }
      ]
    });
  }

  private updateLineChart(monthlyData: MonthlyReportData[]): void {
    const labels = monthlyData.map(m => {
      const [year, month] = m.month.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    this.lineChartData.set({
      labels,
      datasets: [{
        label: 'Net Savings',
        data: monthlyData.map(m => m.netSavings),
        borderColor: '#3B82F6',
        backgroundColor: '#3B82F620',
        fill: true,
        tension: 0.4
      }]
    });
  }

  private initChartOptions(): void {
    // Stacked bar chart options
    this.stackedBarOptions.set({
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            padding: 15
          }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.y || 0;
              return `${context.dataset.label}: ${formatCurrency(value, 'en-US', '$', '1.2-2')}`;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false }
        },
        y: {
          stacked: true,
          ticks: {
            callback: (value: any) => formatCurrency(value, 'en-US', '$', '1.2-2')
          }
        }
      }
    });

    // Line chart options
    this.lineChartOptions.set({
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            padding: 15
          }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.y || 0;
              return `Net Savings: ${formatCurrency(value, 'en-US', '$', '1.2-2')}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          ticks: {
            callback: (value: any) => formatCurrency(value, 'en-US', '$', '1.2-2')
          }
        }
      }
    });
  }

  protected getSavingsClass(netSavings: number): string {
    return netSavings >= 0 ? 'text-green-600' : 'text-red-600';
  }
}
