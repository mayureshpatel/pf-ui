import {Component, computed, effect, inject, input, InputSignal, Signal, signal, WritableSignal} from '@angular/core';
import {CommonModule, formatCurrency} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ChartModule} from 'primeng/chart';
import {TableModule} from 'primeng/table';
import {TagModule} from 'primeng/tag';
import {Transaction} from '@models/transaction.model';
import {ReportsDataService} from '../../services/reports-data.service';
import {VendorReportData} from '../../models/reports.model';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-vendor-report',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, TableModule, TagModule, FormatCurrencyPipe],
  templateUrl: './vendor-report.component.html'
})
export class VendorReportComponent {
  // injected services
  private readonly dataService: ReportsDataService = inject(ReportsDataService);

  // input signals
  transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();

  // computed signals
  protected vendorData: Signal<VendorReportData[]> = computed((): VendorReportData[] => {
    return this.dataService.aggregateByVendor(this.transactions());
  });

  protected hasData: Signal<boolean> = computed(() => this.vendorData().length > 0);

  // signals
  protected barChartData: WritableSignal<any> = signal({});
  protected barChartOptions: WritableSignal<any> = signal({});
  protected doughnutChartData: WritableSignal<any> = signal({});
  protected doughnutChartOptions: WritableSignal<any> = signal({});

  constructor() {
    effect((): void => {
      const vendors: VendorReportData[] = this.vendorData();
      if (vendors.length > 0) {
        this.updateBarChart(vendors);
        this.updateDoughnutChart(vendors);
      }
    });
    this.initChartOptions();
  }

  private updateBarChart(vendors: VendorReportData[]): void {
    const top10: VendorReportData[] = vendors.slice(0, 10);

    const labels: string[] = top10.map((v: VendorReportData): string => v.merchant.cleanName || 'Uknown Merchant');
    const data: number[] = top10.map((v: VendorReportData): number => v.total);

    // Generate colors based on the vendor index
    const colors: string[] = top10.map((_: VendorReportData, index: number): string => {
      const hue: number = (index * 360 / 10) % 360;
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
    const top5: VendorReportData[] = vendors.slice(0, 5);

    const labels: string[] = top5.map((v: VendorReportData): string => v.merchant.cleanName || 'Unknown Merchant');
    const data: number[] = top5.map((v: VendorReportData): number => v.total);

    // Generate colors
    const colors: string[] = [
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
        legend: {display: false},
        tooltip: {
          callbacks: {
            label: (context: any): string => {
              const value = context.parsed.x || 0;
              return `Total: ${formatCurrency(value, 'en-US', '$', '1.2-2')}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: (value: any): string => formatCurrency(value, 'en-US', '$', '1.2-2')
          },
          grid: {display: false}
        },
        y: {grid: {display: false}}
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
            label: (context: any): string => {
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a: number, b: number): number => a + b, 0);
              const percentage: string = ((value / total) * 100).toFixed(1);
              return `${context.label}: ${formatCurrency(value, 'en-US', '$', '1.2-2')} (${percentage}%)`;
            }
          }
        }
      }
    });
  }
}
