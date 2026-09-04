import {Component, computed, inject, input, InputSignal, Signal} from '@angular/core';
import {CommonModule, formatCurrency} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ChartModule} from 'primeng/chart';
import {TableModule} from 'primeng/table';
import {TagModule} from 'primeng/tag';

import {Transaction} from '@models/transaction.model';
import {ReportsDataService} from '../../services/reports-data.service';
import {MerchantReportData} from '../../models/reports.model';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

/**
 * Sub-report component for analyzing spending volume by merchant.
 *
 * Provides a horizontal bar chart for volume leaders, a doughnut chart for
 * distribution, and a detailed merchant list with associated categories.
 */
@Component({
  selector: 'app-merchant-report',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, TableModule, TagModule, FormatCurrencyPipe],
  templateUrl: './merchant-report.component.html'
})
export class MerchantReportComponent {
  private readonly dataService: ReportsDataService = inject(ReportsDataService);

  /** The dataset of transactions to analyze. */
  readonly transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();

  /** Aggregated report data calculated reactively from transactions. */
  readonly merchantData: Signal<MerchantReportData[]> = computed((): MerchantReportData[] =>
    this.dataService.aggregateByMerchant(this.transactions())
  );

  /** Indicates if there is sufficient data to render visuals. */
  readonly hasData: Signal<boolean> = computed((): boolean => this.merchantData().length > 0);

  /**
   * Derived Bar Chart data for volume leaders.
   */
  readonly barChartData: Signal<any> = computed(() => {
    const data: MerchantReportData[] = this.merchantData().slice(0, 10);

    return {
      labels: data.map((v: MerchantReportData): string => v.merchant.cleanName || 'Unknown'),
      datasets: [{
        label: 'Total Spent',
        data: data.map((v: MerchantReportData): number => v.total),
        backgroundColor: data.map((_: MerchantReportData, i: number): string => `hsl(${(i * 36) % 360}, 70%, 60%)`),
        borderRadius: 8,
        barThickness: 32
      }]
    };
  });

  /**
   * Derived Doughnut Chart data for spending distribution.
   */
  readonly doughnutChartData: Signal<any> = computed(() => {
    const data: MerchantReportData[] = this.merchantData().slice(0, 5);

    return {
      labels: data.map((v: MerchantReportData): string => v.merchant.cleanName || 'Unknown'),
      datasets: [{
        data: data.map((v: MerchantReportData): number => v.total),
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
        hoverOffset: 20,
        borderWidth: 0
      }]
    };
  });

  /**
   * Static chart options for the bar chart.
   */
  readonly barChartOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: {display: false},
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        usePointStyle: true,
        callbacks: {
          label: (context: any): string => ` Total: ${formatCurrency(context.parsed.x || 0, 'en-US', '$', '1.2-2')}`
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: {color: 'rgba(148, 163, 184, 0.1)', drawBorder: false},
        ticks: {color: '#94a3b8', font: {size: 11, family: 'monospace'}}
      },
      y: {
        grid: {display: false},
        ticks: {color: '#64748b', font: {size: 12, weight: '700'}}
      }
    }
  };

  /**
   * Static chart options for the doughnut chart.
   */
  readonly doughnutChartOptions = {
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {usePointStyle: true, pointStyle: 'circle', padding: 20, font: {size: 11, weight: 'bold'}}
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        callbacks: {
          label: (context: any): string => {
            const val: any = context.parsed || 0;
            const total: number = context.dataset.data.reduce((a: number, b: number): number => a + b, 0);
            const pct: string = ((val / total) * 100).toFixed(1);
            return ` ${context.label}: ${formatCurrency(val, 'en-US', '$', '1.2-2')} (${pct}%)`;
          }
        }
      }
    }
  };
}
