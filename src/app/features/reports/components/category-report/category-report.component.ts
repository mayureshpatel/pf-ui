import {Component, computed, effect, inject, input, signal, WritableSignal} from '@angular/core';
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
  private readonly dataService = inject(ReportsDataService);

  transactions = input.required<Transaction[]>();

  // Aggregated data
  protected categoryData = computed(() => {
    return this.dataService.aggregateByCategory(this.transactions());
  });

  protected hasData = computed(() => this.categoryData().length > 0);

  // Chart data
  protected chartData: WritableSignal<any> = signal({});
  protected chartOptions: WritableSignal<any> = signal({});

  constructor() {
    effect(() => {
      const categories = this.categoryData();
      if (categories.length > 0) {
        this.updateChartData(categories);
      }
    });
    this.initChartOptions();
  }

  private updateChartData(categories: CategoryReportData[]): void {
    const top10 = categories.slice(0, 10);

    const labels = top10.map(c => c.categoryName);
    const data = top10.map(c => Math.abs(c.total));
    const colors = top10.map(c => getCategoryColorHex(c.categoryName));

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
            label: (context: any) => {
              const value = context.parsed.x || 0;
              return `Spent: ${formatCurrency(value, 'en-US', '$', '1.2-2')}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: (value: any) => formatCurrency(value, 'en-US', '$', '1.2-2')
          },
          grid: {display: false}
        },
        y: {grid: {display: false}}
      }
    });
  }
}
