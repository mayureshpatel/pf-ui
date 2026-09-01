import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CashFlowTrendComponent} from './cash-flow-trend.component';
import {CashFlowTrend} from '@models/dashboard.model';

describe('CashFlowTrendComponent', () => {
  let component: CashFlowTrendComponent;
  let fixture: ComponentFixture<CashFlowTrendComponent>;

  const mockTrendData: CashFlowTrend[] = [
    {month: 12, year: 2025, income: 4800, expense: 3000},
    {month: 1, year: 2026, income: 5000, expense: 3200},
    {month: 3, year: 2026, income: 5200, expense: 2800}
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CashFlowTrendComponent]
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
      const incomeDataset = result.datasets.find((d: any) => d.label === 'Income');
      const expenseDataset = result.datasets.find((d: any) => d.label === 'Expenses');

      expect(incomeDataset.data).toEqual([4800, 5000, 5200]);
      expect(expenseDataset.data).toEqual([3000, 3200, 2800]);
    });

    it('should style the Income and Expenses datasets with their distinct semantic colors', () => {
      // arrange
      fixture.componentRef.setInput('data', mockTrendData);

      // act
      const result = component.chartData();

      // assert & verify
      const incomeDataset = result.datasets.find((d: any) => d.label === 'Income');
      const expenseDataset = result.datasets.find((d: any) => d.label === 'Expenses');

      expect(incomeDataset.backgroundColor).toBe('#10b981');
      expect(expenseDataset.backgroundColor).toBe('#f43f5e');
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
      fixture.componentRef.setInput('data', [{month: 6, year: 2024, income: 100, expense: 50}]);

      // assert & verify
      const result = component.chartData();
      expect(result.labels).toEqual(['Jun 24']);
      expect(result.datasets[0].data).toEqual([100]);
      expect(result.datasets[1].data).toEqual([50]);
    });
  });
});
