import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MerchantReportComponent } from './merchant-report.component';
import { Transaction, TransactionType } from '@models/transaction.model';
import { Merchant } from '@models/merchant.model';
import { Category, CategoryType } from '@models/category.model';

describe('MerchantReportComponent', () => {
  let component: MerchantReportComponent;
  let fixture: ComponentFixture<MerchantReportComponent>;

  const merchant = (id: number, cleanName: string): Merchant => ({
    id,
    userId: 1,
    originalName: cleanName,
    cleanName,
  });
  const category = (name: string): Category =>
    ({
      id: 1,
      userId: 1,
      name,
      type: CategoryType.EXPENSE,
      parent: null,
      icon: 'pi-tag',
      color: '',
    }) as Category;

  const expense = (id: number, m: Merchant, amount: number, cat?: Category): Transaction =>
    ({
      id,
      account: {} as Transaction['account'],
      category: cat ?? null,
      amount,
      date: '2026-01-15T00:00:00Z',
      description: 'test',
      type: TransactionType.EXPENSE,
      merchant: m,
    }) as Transaction;

  const target = merchant(1, 'Target');
  const amazon = merchant(2, 'Amazon');

  const mockTransactions: Transaction[] = [
    expense(1, target, 250, category('Shopping')),
    expense(2, target, 90, category('Groceries')),
    expense(3, amazon, 60, category('Shopping')),
  ];

  const setTransactions = (data: Transaction[]): void => {
    fixture.componentRef.setInput('transactions', data);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MerchantReportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MerchantReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setTransactions(mockTransactions);

    expect(component).toBeTruthy();
  });

  describe('merchantData (delegates to the real ReportsDataService)', () => {
    it('should aggregate total/count/categories per merchant, sorted by total descending', () => {
      // arrange & act
      setTransactions(mockTransactions);

      // assert & verify
      expect(component.merchantData()).toEqual([
        { merchant: target, total: 340, count: 2, categories: ['Shopping', 'Groceries'] },
        { merchant: amazon, total: 60, count: 1, categories: ['Shopping'] },
      ]);
    });
  });

  describe('hasData', () => {
    it('should be false when there are no transactions', () => {
      setTransactions([]);

      expect(component.hasData()).toBe(false);
    });

    it('should be true when at least one merchant aggregates', () => {
      setTransactions(mockTransactions);

      expect(component.hasData()).toBe(true);
    });
  });

  describe('barChartData', () => {
    it("should label each bar with the merchant's clean name and chart its total", () => {
      // arrange & act
      setTransactions(mockTransactions);

      // assert & verify
      expect(component.barChartData().labels).toEqual(['Target', 'Amazon']);
      expect(component.barChartData().datasets[0].data).toEqual([340, 60]);
    });

    it('should cap displayed merchants to the top 10 by spend', () => {
      // arrange -- 12 distinct merchants, descending totals
      const many: Transaction[] = Array.from({ length: 12 }, (_, i): Transaction =>
        expense(i, merchant(i, `Merchant ${i}`), 1000 - i * 10),
      );

      // act
      setTransactions(many);

      // assert & verify
      expect(component.barChartData().labels).toHaveLength(10);
      expect(component.barChartData().labels).not.toContain('Merchant 10');
      expect(component.barChartData().labels).not.toContain('Merchant 11');
    });

    it('should assign each bar a deterministic hue-rotated color', () => {
      // arrange & act
      setTransactions(mockTransactions);

      // assert & verify -- hsl(i * 36 % 360, 70%, 60%)
      expect(component.barChartData().datasets[0].backgroundColor).toEqual([
        'hsl(0, 70%, 60%)',
        'hsl(36, 70%, 60%)',
      ]);
    });

    it("should fall back to 'Unknown' when a merchant has no clean name", () => {
      // arrange & act
      setTransactions([expense(9, merchant(9, ''), 25)]);

      // assert & verify
      expect(component.barChartData().labels).toEqual(['Unknown']);
    });
  });

  describe('doughnutChartData', () => {
    it('should cap displayed merchants to the top 5 by spend regardless of bar-chart data', () => {
      // arrange
      const many: Transaction[] = Array.from({ length: 8 }, (_, i): Transaction =>
        expense(i, merchant(i, `Merchant ${i}`), 1000 - i * 10),
      );

      // act
      setTransactions(many);

      // assert & verify
      expect(component.doughnutChartData().labels).toHaveLength(5);
      expect(component.barChartData().labels).toHaveLength(8);
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
      expect(charts[1].componentInstance.type).toBe('doughnut');
      expect(fixture.nativeElement.textContent).not.toContain('No merchant activity');
      expect(fixture.nativeElement.textContent).not.toContain('No distribution data');
    });

    it('should render empty-state placeholders instead of charts when there is no data', () => {
      // arrange & act
      setTransactions([]);
      const charts = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-chart');

      // assert & verify
      expect(charts).toHaveLength(0);
      expect(fixture.nativeElement.textContent).toContain('No merchant activity');
      expect(fixture.nativeElement.textContent).toContain('No distribution data');
    });

    it('should render one details-table row per merchant with formatted currency and category chips', () => {
      // arrange & act
      setTransactions(mockTransactions);
      const rows = fixture.nativeElement.querySelectorAll('tbody tr');

      // assert & verify
      expect(rows).toHaveLength(2);
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Target');
      expect(text).toContain('$340.00');
      expect(text).toContain('Amazon');
      expect(text).toContain('$60.00');
      expect(text).toContain('Shopping');
      expect(text).toContain('Groceries');
    });

    it("should fall back through cleanName -> originalName -> 'Unknown Merchant' in the table", () => {
      // arrange & act -- cleanName blank, originalName present
      const blankClean: Merchant = {
        id: 3,
        userId: 1,
        originalName: 'RAW MERCHANT NAME',
        cleanName: '',
      };
      setTransactions([expense(4, blankClean, 15)]);

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('RAW MERCHANT NAME');
    });
  });
});
