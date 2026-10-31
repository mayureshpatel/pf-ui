import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryChartComponent } from './category-chart.component';
import { CategoryBreakdown } from '@models/dashboard.model';
import { Category, CategoryType } from '@models/category.model';
import { getCategoryColor } from '@shared/utils/category.utils';

describe('CategoryChartComponent', () => {
  let component: CategoryChartComponent;
  let fixture: ComponentFixture<CategoryChartComponent>;

  const category = (name: string, color: string): Category =>
    ({
      id: 1,
      userId: 1,
      name,
      type: CategoryType.EXPENSE,
      parent: null,
      icon: 'pi-tag',
      color,
    }) as Category;

  const mockBreakdown: CategoryBreakdown[] = [
    { category: category('Rent', '#3B82F6'), total: -900 },
    { category: category('Groceries', '#10B981'), total: -450.75 },
    { category: category('Dining Out', ''), total: -120 },
    { category: category('Gas', '#F97316'), total: -80 },
    { category: category('Subscriptions', ''), total: -35 },
    { category: category('Coffee', '#EC4899'), total: -10 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryChartComponent],
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

  describe('rows', () => {
    it('should sort items by absolute total, descending', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify
      expect(component.rows().map((row) => row.name)).toEqual([
        'Rent',
        'Groceries',
        'Dining Out',
        'Gas',
        'Subscriptions',
      ]);
    });

    it('should limit displayed items to the default topX of 5', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify -- 'Coffee' (smallest, -10) is excluded
      expect(component.rows()).toHaveLength(5);
      expect(component.rows().map((row) => row.name)).not.toContain('Coffee');
    });

    it('should re-slice reactively when topX changes', () => {
      // arrange
      setCategories(mockBreakdown);

      // act
      fixture.componentRef.setInput('topX', 2);
      fixture.detectChanges();

      // assert & verify
      expect(component.rows().map((row) => row.name)).toEqual(['Rent', 'Groceries']);
    });

    it('should map totals to their absolute value, not the raw signed amount', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify -- all backing totals are negative (expenses)
      expect(component.rows().map((row) => row.amount)).toEqual([900, 450.75, 120, 80, 35]);
    });

    it("should label an item with no category as 'Uncategorized'", () => {
      // arrange & act
      setCategories([{ category: null as unknown as Category, total: -75 }, ...mockBreakdown]);

      // assert & verify -- -75 sorts ahead of Gas/Subscriptions/Coffee but behind Rent/Groceries
      expect(component.rows().map((row) => row.name)).toContain('Uncategorized');
    });

    it("should use the category's own color when set, else a name-derived color", () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify -- 'Rent' has a color; 'Dining Out' (index 2) does not
      expect(component.rows()[0].color).toBe('#3B82F6');
      expect(component.rows()[2].color).toBe(getCategoryColor('Dining Out'));
    });

    it('should size each bar relative to the largest shown amount', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify
      expect(component.rows()[0].widthPct).toBe(100);
      expect(component.rows()[1].widthPct).toBeCloseTo((450.75 / 900) * 100, 5);
    });

    it('should give every bar a zero width, not NaN, when all amounts are zero', () => {
      // arrange & act
      setCategories([{ category: category('Rent', '#3B82F6'), total: 0 }]);

      // assert & verify
      expect(component.rows()[0].widthPct).toBe(0);
    });
  });

  describe('rendering (PF-863)', () => {
    const rowEls = (): HTMLElement[] =>
      Array.from(fixture.nativeElement.querySelectorAll('[data-testid="category-row"]'));

    it('should print each category name and its formatted amount as text', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify -- text in the DOM, readable without hovering and by a screen reader
      const rows: HTMLElement[] = rowEls();
      expect(rows).toHaveLength(5);
      expect(rows[0].textContent).toContain('Rent');
      expect(rows[0].textContent).toContain('$900.00');
      expect(rows[1].textContent).toContain('Groceries');
      expect(rows[1].textContent).toContain('$450.75');
    });

    it('should expose the rows as a list', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify
      expect(fixture.nativeElement.querySelector('ul[role="list"]')).not.toBeNull();
    });

    it('should draw bars with HTML, not a canvas chart', () => {
      // arrange & act
      setCategories(mockBreakdown);

      // assert & verify
      expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
      expect(fixture.nativeElement.querySelector('p-chart')).toBeNull();
    });

    it('should keep the empty state text and show no rows when there is no data', () => {
      // arrange & act
      setCategories([]);

      // assert & verify
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('No spending recorded for this period.');
      expect(text).toContain('Try a different time period.');
      expect(rowEls()).toHaveLength(0);
    });
  });
});
