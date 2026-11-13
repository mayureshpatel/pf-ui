import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ChartDataset } from 'chart.js';
import { CashFlowTrendComponent } from './cash-flow-trend.component';
import { CashFlowTrend } from '@models/dashboard.model';
import { ThemeService } from '@core/services/theme.service';

describe('CashFlowTrendComponent', () => {
  let component: CashFlowTrendComponent;
  let fixture: ComponentFixture<CashFlowTrendComponent>;

  const mockTrendData: CashFlowTrend[] = [
    { month: 12, year: 2025, income: 4800, expense: 3000 },
    { month: 1, year: 2026, income: 5000, expense: 3200 },
    { month: 3, year: 2026, income: 5200, expense: 2800 },
  ];

  afterEach(() => {
    TestBed.inject(ThemeService).setDarkMode(false);
    localStorage.removeItem('pf_dark_mode');
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashFlowTrendComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CashFlowTrendComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('data', mockTrendData);
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  describe('chartData', () => {
    it('should format each entry into a short month/year label', () => {
      // arrange
      fixture.componentRef.setInput('data', mockTrendData);

      // act
      const result = component.chartData();

      // assert & verify
      expect(result.labels).toEqual(['Dec 25', 'Jan 26', 'Mar 26']);
    });

    it('should map income and expense values into their respective datasets, in order', () => {
      // arrange
      fixture.componentRef.setInput('data', mockTrendData);

      // act
      const result = component.chartData();

      // assert & verify
      const incomeDataset = result.datasets.find((d: ChartDataset<'bar'>) => d.label === 'Income')!;
      const expenseDataset = result.datasets.find(
        (d: ChartDataset<'bar'>) => d.label === 'Expenses',
      )!;

      expect(incomeDataset.data).toEqual([4800, 5000, 5200]);
      expect(expenseDataset.data).toEqual([3000, 3200, 2800]);
    });

    it('should style the Income and Expenses datasets with their distinct semantic colors', () => {
      // arrange
      fixture.componentRef.setInput('data', mockTrendData);

      // act
      const result = component.chartData();

      // assert & verify
      const incomeDataset = result.datasets.find((d: ChartDataset<'bar'>) => d.label === 'Income')!;
      const expenseDataset = result.datasets.find(
        (d: ChartDataset<'bar'>) => d.label === 'Expenses',
      )!;

      expect(incomeDataset.backgroundColor).toBe('#059669'); // primary-600
      expect(expenseDataset.backgroundColor).toBe('#e11d48'); // rose-600
    });

    it('should return empty labels and dataset data arrays when given no trend data', () => {
      // arrange
      fixture.componentRef.setInput('data', []);

      // act
      const result = component.chartData();

      // assert & verify
      expect(result.labels).toEqual([]);
      expect(result.datasets).toHaveLength(2);
      expect(result.datasets[0].data).toEqual([]);
      expect(result.datasets[1].data).toEqual([]);
    });

    it('should recompute reactively when the data input changes', () => {
      // arrange
      fixture.componentRef.setInput('data', mockTrendData);
      expect(component.chartData().labels).toEqual(['Dec 25', 'Jan 26', 'Mar 26']);

      // act
      fixture.componentRef.setInput('data', [{ month: 6, year: 2024, income: 100, expense: 50 }]);

      // assert & verify
      const result = component.chartData();
      expect(result.labels).toEqual(['Jun 24']);
      expect(result.datasets[0].data).toEqual([100]);
      expect(result.datasets[1].data).toEqual([50]);
    });
  });

  describe('theme colors', () => {
    function seriesColors(): { income: unknown; expense: unknown } {
      const [income, expense] = component.chartData().datasets;
      return { income: income.backgroundColor, expense: expense.backgroundColor };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function options(): any {
      return component.chartOptions();
    }

    beforeEach(() => fixture.componentRef.setInput('data', mockTrendData));

    it('should use warm stone muted text for ticks in light mode, not cool slate', () => {
      // assert & verify
      expect(options().scales.x.ticks.color).toBe('#6b655f');
      expect(options().scales.y.ticks.color).toBe('#6b655f');
    });

    it('should use lighter stone for ticks and lighter series colors in dark mode', () => {
      // act
      TestBed.inject(ThemeService).setDarkMode(true);

      // assert & verify
      expect(options().scales.x.ticks.color).toBe('#a8a29e');
      expect(seriesColors()).toEqual({ income: '#34d399', expense: '#fb7185' });
    });

    it('should never use the old cool-slate or 500-shade values', () => {
      // act
      const serialized: string = JSON.stringify([options(), component.chartData()]);

      // assert & verify
      for (const old of ['#94a3b8', '#64748b', '#1e293b', '#10b981', '#f43f5e']) {
        expect(serialized).not.toContain(old);
      }
    });

    it('should keep every tick at 12px or larger', () => {
      // assert & verify
      expect(options().scales.x.ticks.font.size).toBeGreaterThanOrEqual(12);
      expect(options().scales.y.ticks.font.size).toBeGreaterThanOrEqual(12);
    });
  });

  describe('scope caption', () => {
    const caption = (): string =>
      fixture.nativeElement.querySelector('[data-testid="trend-scope"]').textContent;

    const months = (count: number): CashFlowTrend[] =>
      Array.from({ length: count }, (_: unknown, i: number): CashFlowTrend => {
        const index: number = 2025 * 12 + 11 + i; // Dec 2025 onward
        return { year: Math.floor(index / 12), month: (index % 12) + 1, income: 100, expense: 50 };
      });

    it('should say the chart ignores the selected period', () => {
      // act
      fixture.componentRef.setInput('data', months(12));
      fixture.detectChanges();

      // assert & verify
      expect(caption()).toContain('Last 12 months');
      expect(caption()).toContain('whatever period is selected');
    });

    it('should name the months shown when there are fewer than 12', () => {
      // act -- Dec 2025 to Mar 2026
      fixture.componentRef.setInput('data', mockTrendData);
      fixture.detectChanges();

      // assert & verify
      expect(caption()).toContain('Dec 2025 to Mar 2026');
      expect(caption()).not.toContain('Last 12 months');
      expect(caption()).toContain('whatever period is selected');
    });

    it('should name a single month on its own', () => {
      // act
      fixture.componentRef.setInput('data', [{ month: 8, year: 2026, income: 10, expense: 5 }]);
      fixture.detectChanges();

      // assert & verify
      expect(caption()).toContain('Aug 2026');
      expect(caption()).not.toContain(' to ');
    });

    it('should describe the months actually shown to assistive tech', () => {
      // act
      fixture.componentRef.setInput('data', mockTrendData);
      fixture.detectChanges();

      // assert & verify
      const label: string | null = fixture.nativeElement
        .querySelector('p-chart canvas')
        .getAttribute('aria-label');
      expect(label).toContain('Dec 2025 to Mar 2026');
      expect(label).not.toContain('12 months');
    });
  });

  describe('text alternative', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('data', mockTrendData);
      fixture.detectChanges();
    });

    it('should expose a table with one row per month for assistive tech', () => {
      // assert & verify
      const rows = fixture.nativeElement.querySelectorAll('[data-testid="trend-table"] tbody tr');
      expect(rows).toHaveLength(3);
      expect(rows[1].textContent).toContain('Jan 26');
      expect(rows[1].textContent).toContain('$5,000.00');
      expect(rows[1].textContent).toContain('$3,200.00');
      expect(rows[1].textContent).toContain('$1,800.00');
    });

    it('should show a visible summary of the latest month with its net', () => {
      // assert & verify
      const text: string = fixture.nativeElement
        .querySelector('[data-testid="trend-latest"]')
        .textContent.replace(/\s+/g, ' ');
      expect(text).toContain('Mar 26');
      expect(text).toContain('$5,200.00');
      expect(text).toContain('$2,800.00');
      expect(text).toContain('$2,400.00');
    });

    it('should omit the latest-month summary when there is no data', () => {
      // act
      fixture.componentRef.setInput('data', []);
      fixture.detectChanges();

      // assert & verify
      expect(fixture.nativeElement.querySelector('[data-testid="trend-latest"]')).toBeNull();
    });
  });
  describe('empty months', () => {
    const withTail: CashFlowTrend[] = [
      { month: 7, year: 2026, income: 0, expense: 0 },
      { month: 8, year: 2026, income: 6313.59, expense: 4027.41 },
      { month: 9, year: 2026, income: 0, expense: 0 },
      { month: 10, year: 2026, income: 0, expense: 0 },
      { month: 11, year: 2026, income: 0, expense: 0 },
    ];

    it('should drop the empty months after the last month with data', () => {
      // arrange & act
      fixture.componentRef.setInput('data', withTail);

      // assert & verify
      expect(component.chartData().labels).toEqual(['Jul 26', 'Aug 26']);
      expect(component.rows().map((r) => r.label)).toEqual(['Jul 26', 'Aug 26']);
    });

    it('should keep an empty month that sits between months with data', () => {
      // arrange & act
      fixture.componentRef.setInput('data', [
        { month: 1, year: 2026, income: 100, expense: 50 },
        { month: 2, year: 2026, income: 0, expense: 0 },
        { month: 3, year: 2026, income: 100, expense: 50 },
      ]);

      // assert & verify
      expect(component.chartData().labels).toEqual(['Jan 26', 'Feb 26', 'Mar 26']);
    });

    it('should summarise the latest month with data, not the empty current month', () => {
      // arrange & act
      fixture.componentRef.setInput('data', withTail);
      fixture.detectChanges();

      // assert & verify
      const text: string = fixture.nativeElement
        .querySelector('[data-testid="trend-latest"]')
        .textContent.replace(/\s+/g, ' ');
      expect(text).toContain('Aug 26');
      expect(text).not.toContain('Nov 26');
    });

    it('should show no chart rows or summary when every month is empty', () => {
      // arrange & act
      fixture.componentRef.setInput('data', [{ month: 11, year: 2026, income: 0, expense: 0 }]);
      fixture.detectChanges();

      // assert & verify
      expect(component.rows()).toEqual([]);
      expect(fixture.nativeElement.querySelector('[data-testid="trend-latest"]')).toBeNull();
    });
  });

  describe('selected month', () => {
    it('should summarise the selected month instead of the latest', () => {
      // arrange
      fixture.componentRef.setInput('data', mockTrendData);
      fixture.componentRef.setInput('focus', { month: 1, year: 2026 });

      // act
      fixture.detectChanges();

      // assert & verify
      const text: string = fixture.nativeElement
        .querySelector('[data-testid="trend-latest"]')
        .textContent.replace(/\s+/g, ' ');
      expect(text).toContain('Jan 26');
      expect(text).toContain('$5,000.00');
    });

    it('should dim the other months so the selected one stands out', () => {
      // arrange
      fixture.componentRef.setInput('data', mockTrendData);
      fixture.componentRef.setInput('focus', { month: 1, year: 2026 });

      // act
      const income = component
        .chartData()
        .datasets.find((d: ChartDataset<'bar'>) => d.label === 'Income')!
        .backgroundColor as string[];

      // assert & verify
      expect(income).toEqual(['#05966966', '#059669', '#05966966']);
    });

    it('should leave every bar at full strength when no month is selected', () => {
      // arrange & act
      fixture.componentRef.setInput('data', mockTrendData);

      // assert & verify
      const income = component
        .chartData()
        .datasets.find((d: ChartDataset<'bar'>) => d.label === 'Income')!;
      expect(income.backgroundColor).toBe('#059669');
    });

    it('should fall back to the latest month when the selected month is not in the chart', () => {
      // arrange & act
      fixture.componentRef.setInput('data', mockTrendData);
      fixture.componentRef.setInput('focus', { month: 10, year: 2026 });
      fixture.detectChanges();

      // assert & verify
      expect(
        fixture.nativeElement.querySelector('[data-testid="trend-latest"]').textContent,
      ).toContain('Mar 26');
      const income = component
        .chartData()
        .datasets.find((d: ChartDataset<'bar'>) => d.label === 'Income')!;
      expect(income.backgroundColor).toBe('#059669');
    });
  });
  it('should title the card with a heading so it can be jumped to', () => {
    // arrange & act
    fixture.componentRef.setInput('data', mockTrendData);
    fixture.detectChanges();

    // assert & verify
    expect(fixture.nativeElement.querySelector('h2')?.textContent).toContain('Cash flow');
  });
});
