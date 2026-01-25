import { Component, input, computed, signal, effect, inject, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { Transaction } from '@models/transaction.model';
import { ReportsDataService } from '../../services/reports-data.service';
import { VendorReportData } from '../../models/reports.model';
import { formatCurrency } from '@shared/utils/account.utils';

@Component({
  selector: 'app-vendor-report',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, TableModule, TagModule],
  templateUrl: './vendor-report.component.html'
})
export class VendorReportComponent {
  private readonly dataService = inject(ReportsDataService);

  transactions = input.required<Transaction[]>();

  // Aggregated data
  protected vendorData = computed(() => {
    return this.dataService.aggregateByVendor(this.transactions());
  });

  protected hasData = computed(() => this.vendorData().length > 0);

  // Chart data
  protected barChartData: WritableSignal<any> = signal({});
  protected barChartOptions: WritableSignal<any> = signal({});
  protected doughnutChartData: WritableSignal<any> = signal({});
  protected doughnutChartOptions: WritableSignal<any> = signal({});

  // Expose formatCurrency for template
  protected readonly formatCurrency = formatCurrency;

  constructor() {
    effect(() => {
      const vendors = this.vendorData();
      if (vendors.length > 0) {
        this.updateBarChart(vendors);
        this.updateDoughnutChart(vendors);
      }
    });
    this.initChartOptions();
  }

  private updateBarChart(vendors: VendorReportData[]): void {
    const top10 = vendors.slice(0, 10);

    const labels = top10.map(v => v.vendorName);
    const data = top10.map(v => v.total);

    // Generate colors based on vendor index
    const colors = top10.map((_, index) => {
      const hue = (index * 360 / 10) % 360;
      return `hsl(${hue}, 70%, 60%)`;
    });

    this.barChartData.set({
      labels,
      datasets: [{
        label: 'Total Spent',
        data,
        backgroundColor: colors,
        borderRadius: 6,
        barThickness: 32
      }]
    });
  }

  private updateDoughnutChart(vendors: VendorReportData[]): void {
    const top5 = vendors.slice(0, 5);

    const labels = top5.map(v => v.vendorName);
    const data = top5.map(v => v.total);

    // Generate colors
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F97316', // orange
      '#8B5CF6', // purple
      '#EC4899'  // pink
    ];

    this.doughnutChartData.set({
      labels,
      datasets: [{
        data,
        backgroundColor: colors
      }]
    });
  }

  private initChartOptions(): void {
    // Bar chart options
    this.barChartOptions.set({
      indexAxis: 'y', // Horizontal bar chart
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.x || 0;
              return `Total: ${formatCurrency(value)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: (value: any) => formatCurrency(value)
          },
          grid: { display: false }
        },
        y: { grid: { display: false } }
      }
    });

    // Doughnut chart options
    this.doughnutChartOptions.set({
      maintainAspectRatio: false,
      aspectRatio: 1,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
            }
          }
        }
      }
    });
  }
}
