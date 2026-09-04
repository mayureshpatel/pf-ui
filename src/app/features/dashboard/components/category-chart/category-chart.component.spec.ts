import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CategoryChartComponent} from './category-chart.component';
import {CategoryBreakdown} from '@models/dashboard.model';
import {Category, CategoryType} from '@models/category.model';
import {getCategoryColor} from '@shared/utils/category.utils';

describe('CategoryChartComponent', () => {
  let component: CategoryChartComponent;
  let fixture: ComponentFixture<CategoryChartComponent>;

  const category = (name: string, color: string): Category =>
    ({id: 1, userId: 1, name, type: CategoryType.EXPENSE, parent: null, icon: 'pi-tag', color}) as Category;

  const mockBreakdown: CategoryBreakdown[] = [
    {category: category('Rent', '#3B82F6'), total: -900},
    {category: category('Groceries', '#10B981'), total: -450.75},
    {category: category('Dining Out', ''), total: -120},
    {category: category('Gas', '#F97316'), total: -80},
    {category: category('Subscriptions', ''), total: -35},
    {category: category('Coffee', '#EC4899'), total: -10}
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryChartComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryChartComponent);
    component = fixture.componentInstance;
  });

  const setCategories = (data: CategoryBreakdown[]): void => {
    fixture.componentRef.setInput('categories', data);
    fixture.detectChanges();
  };

  it('should create', () => {
    setCategories(mockBreakdown);

    expect(component).toBeTruthy();
  });

  describe('hasData', () => {
    it('should be true when categories are provided', () => {
      setCategories(mockBreakdown);

      expect(component.hasData()).toBe(true);
    });

    it('should be false when categories is empty', () => {
      setCategories([]);

      expect(component.hasData()).toBe(false);
    });
  });

  describe('chartData (effect-driven)', () => {
    it('should sort items by absolute total, descending', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify
      expect(component.chartData().labels).toEqual(['Rent', 'Groceries', 'Dining Out', 'Gas', 'Subscriptions']);
    });

    it('should limit displayed items to the default topX of 5', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify -- 'Coffee' (smallest, -10) is excluded
      expect(component.chartData().labels).toHaveLength(5);
      expect(component.chartData().labels).not.toContain('Coffee');
    });

    it('should re-slice reactively when topX changes', () => {
      // arrange
      setCategories(mockBreakdown);
      expect(component.chartData().labels).toHaveLength(5);

      // act
      fixture.componentRef.setInput('topX', 2);
      fixture.detectChanges();

      // assert & verify
      expect(component.chartData().labels).toEqual(['Rent', 'Groceries']);
    });

    it('should map totals to their absolute value, not the raw signed amount', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify -- all backing totals are negative (expenses)
      expect(component.chartData().datasets[0].data).toEqual([900, 450.75, 120, 80, 35]);
    });

    it("should label an item with no category as 'Uncategorized'", () => {
      // arrange & act
      setCategories([
        {category: null as unknown as Category, total: -75},
        ...mockBreakdown
      ]);

      // assert & verify -- -75 sorts ahead of Gas/Subscriptions/Coffee but behind Rent/Groceries
      expect(component.chartData().labels).toContain('Uncategorized');
    });

    it('should return an empty-but-shaped chart when categories is empty (PF-189)', () => {
      // arrange & act -- computed() always returns a fully-shaped value, matching every
      // sibling chart component (CashFlowTrendComponent, category-report.component.ts)
      setCategories([]);

      // assert & verify
      expect(component.chartData()).toEqual({
        labels: [],
        datasets: [{
          label: 'Total Spent',
          data: [],
          backgroundColor: [],
          borderRadius: 8,
          barThickness: 32,
          hoverBackgroundColor: []
        }]
      });
    });

    describe('bar color', () => {
      it("should use the category's own color directly when one is set", () => {
        // arrange & act
        setCategories(mockBreakdown);

        // assert & verify -- 'Rent' (index 0) has color '#3B82F6' set
        expect(component.chartData().datasets[0].backgroundColor[0]).toBe('#3B82F6');
        expect(component.chartData().datasets[0].hoverBackgroundColor[0]).toBe('#3B82F6');
      });

      it('should fall back to a name-derived color when the category has no color set', () => {
        // arrange & act
        setCategories(mockBreakdown);

        // assert & verify -- 'Dining Out' (index 2) has no color set
        const expected = getCategoryColor('Dining Out');
        expect(component.chartData().datasets[0].backgroundColor[2]).toBe(expected);
        expect(component.chartData().datasets[0].hoverBackgroundColor[2]).toBe(expected);
      });
    });
  });

  describe('chartOptions binding (PF-189)', () => {
    it('should pass p-chart a real options object, not a signal function', () => {
      // arrange & act -- the template binds [options]="chartOptions" with no (), so if
      // chartOptions were still a WritableSignal, p-chart would receive the function itself
      setCategories(mockBreakdown);
      const pChart = fixture.debugElement.query((de: any): boolean => de.name === 'p-chart');

      // assert & verify
      expect(typeof pChart.componentInstance.options).toBe('object');
      expect(pChart.componentInstance.options.indexAxis).toBe('y');
    });
  });
});
