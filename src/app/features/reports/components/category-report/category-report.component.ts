import {Component, computed, effect, inject, input, InputSignal, Signal, signal, WritableSignal} from '@angular/core';
import {CommonModule, formatCurrency} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ChartModule} from 'primeng/chart';
import {TableModule} from 'primeng/table';
import {Transaction} from '@models/transaction.model';
import {ReportsDataService} from '../../services/reports-data.service';
import {CategoryReportData} from '../../models/reports.model';
import {getCategoryColorHex} from '@shared/utils/category.utils';
import {FormatCurrencyPipe} from '@shared/pipes/format-currency.pipe';

@Component({
  selector: 'app-category-report',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule, TableModule, FormatCurrencyPipe],
  templateUrl: './category-report.component.html'
})
export class CategoryReportComponent {
  // injected services
  private readonly dataService: ReportsDataService = inject(ReportsDataService);

  // input signals
  transactions: InputSignal<Transaction[]> = input.required<Transaction[]>();

  // computed signals
  protected categoryData: Signal<CategoryReportData[]> = computed((): CategoryReportData[] => {
    return this.dataService.aggregateByCategory(this.transactions());
  });

  protected hasData: Signal<boolean> = computed((): boolean => this.categoryData().length > 0);

  // signals
  protected chartData: WritableSignal<any> = signal({});
  protected chartOptions: WritableSignal<any> = signal({});

  constructor() {
    effect((): void => {
      const categories: CategoryReportData[] = this.categoryData();

      if (categories.length > 0) {
        this.updateChartData(categories);
      }
    });
    this.initChartOptions();
  }

  private updateChartData(categories: CategoryReportData[]): void {
    const top10: CategoryReportData[] = categories.slice(0, 10);

    const labels: string[] = top10.map((c: CategoryReportData): string => c.category.name || 'Uncategorized');
    const data: number[] = top10.map((c: CategoryReportData): number => Math.abs(c.total));
    const colors: string[] = top10.map((c: CategoryReportData): string => getCategoryColorHex(c.category.iconography.color));

    this.chartData.set({
      labels,
      datasets: [{
        label: 'Spent',
        data,
        backgroundColor: colors,
        borderRadius: 6,
        barThickness: 32
      }]
    });
  }

  private initChartOptions(): void {
    this.chartOptions.set({
      indexAxis: 'y', // Horizontal bar chart
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {display: false},
        tooltip: {
          callbacks: {
            label: (context: any): string => {
              const value: any = context.parsed.x || 0;
              return `Spent: ${formatCurrency(value, 'en-US', '$', '1.2-2')}`;
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
  }
}
