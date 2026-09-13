import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IncomeExpenseReportComponent } from './income-expense-report.component';
import { Transaction, TransactionType } from '@models/transaction.model';

describe('IncomeExpenseReportComponent', () => {
  let component: IncomeExpenseReportComponent;
  let fixture: ComponentFixture<IncomeExpenseReportComponent>;

  const txn = (date: string, type: TransactionType, amount: number): Transaction =>
    ({
      id: 1,
      account: {} as Transaction['account'],
      category: {} as Transaction['category'],
      amount,
      date,
      description: 'test',
      type,
      merchant: {} as Transaction['merchant'],
    }) as Transaction;

  const mockTransactions: Transaction[] = [
    txn('2026-01-10T00:00:00Z', TransactionType.INCOME, 4000),
    txn('2026-01-15T00:00:00Z', TransactionType.EXPENSE, 2500),
    txn('2026-02-05T00:00:00Z', TransactionType.INCOME, 4200),
    txn('2026-02-20T00:00:00Z', TransactionType.EXPENSE, 4800),
  ];

  const setTransactions = (data: Transaction[]): void => {
    fixture.componentRef.setInput('transactions', data);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeExpenseReportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomeExpenseReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setTransactions(mockTransactions);

    expect(component).toBeTruthy();
  });

  describe('monthlyData (delegates to the real ReportsDataService)', () => {
    it('should aggregate income/expense/netSavings per month, sorted chronologically', () => {
      // arrange & act
      setTransactions(mockTransactions);

      // assert & verify -- exhaustive aggregation-logic coverage lives in
      // reports-data.service.spec.ts; this just confirms the component wires its input through
      expect(component.monthlyData()).toEqual([
        { month: '2026-01', income: 4000, expense: 2500, netSavings: 1500 },
        { month: '2026-02', income: 4200, expense: 4800, netSavings: -600 },
      ]);
    });
  });

  describe('hasData', () => {
    it('should be false when there are no transactions', () => {
      setTransactions([]);

      expect(component.hasData()).toBe(false);
    });

    it('should be true when at least one month aggregates', () => {
      setTransactions(mockTransactions);

      expect(component.hasData()).toBe(true);
    });
  });

  describe('stackedBarData', () => {
    it('should label each point with a "MMM YY" month label, chronologically ordered', () => {
      // arrange & act
      setTransactions(mockTransactions);

      // assert & verify
      expect(component.stackedBarData().labels).toEqual(['Jan 26', 'Feb 26']);
    });

    it('should chart raw income and absolute-valued expense as separate datasets', () => {
      // arrange & act
      setTransactions(mockTransactions);
      const [income, expense] = component.stackedBarData().datasets;

      // assert & verify
      expect(income).toMatchObject({ label: 'Income', data: [4000, 4200] });
      expect(expense).toMatchObject({ label: 'Expenses', data: [2500, 4800] });
    });
  });

  describe('lineChartData', () => {
    it('should chart net savings (income minus expense) per month, including negative months', () => {
      // arrange & act
      setTransactions(mockTransactions);

      // assert & verify
      expect(component.lineChartData().labels).toEqual(['Jan 26', 'Feb 26']);
      expect(component.lineChartData().datasets[0]).toMatchObject({
        label: 'Net Savings',
        data: [1500, -600],
      });
    });
  });

  describe('getSavingsClass', () => {
    it('should style non-negative net savings as emerald', () => {
      expect(component.getSavingsClass(1500)).toContain('text-emerald-600');
      expect(component.getSavingsClass(0)).toContain('text-emerald-600');
    });

    it('should style negative net savings as rose', () => {
      expect(component.getSavingsClass(-600)).toContain('text-rose-600');
    });
  });

  describe('rendering', () => {
    it('should render both charts when data is present', () => {
      // arrange & act
      setTransactions(mockTransactions);
      const charts = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-chart');

      // assert & verify
      expect(charts).toHaveLength(2);
      expect(charts[0].componentInstance.type).toBe('bar');
      expect(charts[1].componentInstance.type).toBe('line');
      expect(fixture.nativeElement.textContent).not.toContain('No activity data');
      expect(fixture.nativeElement.textContent).not.toContain('No savings data');
    });

    it('should render empty-state placeholders instead of charts when there is no data', () => {
      // arrange & act
      setTransactions([]);
      const charts = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-chart');

      // assert & verify
      expect(charts).toHaveLength(0);
      expect(fixture.nativeElement.textContent).toContain('No activity data');
      expect(fixture.nativeElement.textContent).toContain('No savings data');
    });

    it('should render one summary-table row per aggregated month with formatted currency', () => {
      // arrange & act
      setTransactions(mockTransactions);
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');

      // assert & verify
      expect(rows).toHaveLength(2);
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('2026-01');
      expect(text).toContain('$4,000.00');
      expect(text).toContain('$2,500.00');
      expect(text).toContain('$1,500.00');
      expect(text).toContain('-$600.00');
    });
  });
});
