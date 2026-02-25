import {Component, computed, input, InputSignal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { CashFlowTrend } from '@models/dashboard.model';

@Component({
  selector: 'app-cash-flow-trend',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './cash-flow-trend.component.html'
})
export class CashFlowTrendComponent {
  data: InputSignal<CashFlowTrend[]> = input.required<CashFlowTrend[]>();

  chartData = computed(() => {
    const trendData: CashFlowTrend[] = this.data();
    const labels: string[] = trendData.map((d: CashFlowTrend): string => {
      const date = new Date(d.year, d.month - 1);
      return date.toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Income',
          backgroundColor: '#10B981',
          data: trendData.map((d: CashFlowTrend) => d.income)
        },
        {
          label: 'Expenses',
          backgroundColor: '#EF4444',
          data: trendData.map((d: CashFlowTrend) => d.expense)
        }
      ]
    };
  });

  chartOptions = {
    maintainAspectRatio: false,
    aspectRatio: 0.8,
    plugins: {
      legend: {
        labels: {
          color: '#6b7280'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#6b7280',
          font: {
            weight: 500
          }
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
          drawBorder: false
        }
      },
      y: {
        ticks: {
          color: '#6b7280'
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
          drawBorder: false
        }
      }
    }
  };
}
