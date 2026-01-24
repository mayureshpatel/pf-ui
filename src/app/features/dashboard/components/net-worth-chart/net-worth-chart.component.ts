import { Component, computed, effect, input, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { UIChart } from 'primeng/chart';
import { DailyBalance } from '@models/dashboard.model';

@Component({
  selector: 'app-net-worth-chart',
  standalone: true,
  imports: [CommonModule, CardModule, UIChart],
  templateUrl: './net-worth-chart.component.html'
})
export class NetWorthChartComponent {
  balances = input.required<DailyBalance[]>();

  chartData: WritableSignal<any> = signal({});
  chartOptions: WritableSignal<any> = signal({});

  hasData = computed(() => this.balances().length > 0);

  constructor() {
    effect(() => {
      const balances = this.balances();
      if (balances.length > 0) {
        this.updateChartData(balances);
      }
    });

    this.initChartOptions();
  }

  private updateChartData(balances: DailyBalance[]): void {
    const labels = balances.map(b => {
      const date = new Date(b.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = balances.map(b => b.balance);

    const documentStyle = getComputedStyle(document.documentElement);
    const primaryColor = documentStyle.getPropertyValue('--primary-500') || '#3B82F6';

    this.chartData.set({
      labels,
      datasets: [
        {
          label: 'Net Worth',
          data,
          fill: true,
          borderColor: primaryColor,
          backgroundColor: primaryColor + '20', // Add transparency
          tension: 0.4
        }
      ]
    });
  }

  private initChartOptions(): void {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color');
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary');
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border');

    this.chartOptions.set({
      maintainAspectRatio: false,
      aspectRatio: 0.6,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = context.parsed.y || 0;
              return `Net Worth: $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: textColorSecondary,
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false
          }
        },
        y: {
          ticks: {
            color: textColorSecondary,
            callback: (value: any) => {
              return '$' + value.toLocaleString();
            }
          },
          grid: {
            color: surfaceBorder,
            drawBorder: false
          }
        }
      }
    });
  }
}
