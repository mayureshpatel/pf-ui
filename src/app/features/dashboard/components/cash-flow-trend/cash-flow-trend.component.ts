import {Component, computed, input, InputSignal, Signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ChartModule} from 'primeng/chart';
import {CashFlowTrend} from '@models/dashboard.model';

/**
 * Component for displaying a bar chart comparison of income and expenses over time.
 *
 * Utilizes PrimeNG Chart.js integration and updates reactively based on input signals.
 */
@Component({
  selector: 'app-cash-flow-trend',
  standalone: true,
  imports: [CommonModule, CardModule, ChartModule],
  templateUrl: './cash-flow-trend.component.html'
})
export class CashFlowTrendComponent {
  /** The trend data to visualize. */
  readonly data: InputSignal<CashFlowTrend[]> = input.required<CashFlowTrend[]>();

  /**
   * Derived signal that transforms the raw trend data into a format
   * compatible with Chart.js.
   */
  readonly chartData: Signal<any> = computed(() => {
    const trendData: CashFlowTrend[] = this.data();

    // Map month/year numbers to short labels (e.g., 'Jan 24')
    const labels: string[] = trendData.map((d: CashFlowTrend): string => {
      const date = new Date(d.year, d.month - 1);
      return date.toLocaleString('default', {month: 'short', year: '2-digit'});
    });

    // Determine if we are in dark mode to adjust grid/text colors
    const isDark: boolean = document.documentElement.classList.contains('dark');
    const surface400 = '#94a3b8';

    return {
      labels,
      datasets: [
        {
          label: 'Income',
          backgroundColor: '#10b981', // emerald-500
          borderRadius: 6,
          data: trendData.map((d: CashFlowTrend): number => d.income)
        },
        {
          label: 'Expenses',
          backgroundColor: '#f43f5e', // rose-500
          borderRadius: 6,
          data: trendData.map((d: CashFlowTrend): number => d.expense)
        }
      ]
    };
  });

  /**
   * Static chart configuration options.
   * Note: Colors are coordinated with the global Tailwind 4 theme.
   */
  readonly chartOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {size: 12, weight: '700'},
          color: '#64748b' // surface-500
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: {size: 14, weight: 'bold'},
        bodyFont: {size: 13},
        usePointStyle: true
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#94a3b8',
          font: {size: 11, weight: '600'}
        },
        grid: {
          display: false,
          drawBorder: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#94a3b8',
          font: {size: 11, family: 'monospace'},
          callback: (value: number): string => `$${value >= 1000 ? (value / 1000) + 'k' : value}`
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false
        }
      }
    }
  };
}
