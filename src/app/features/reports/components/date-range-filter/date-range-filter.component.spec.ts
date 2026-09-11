import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {DateRangeFilterComponent} from './date-range-filter.component';
import {DateRange} from '../../models/reports.model';

describe('DateRangeFilterComponent', () => {
  let component: DateRangeFilterComponent;
  let fixture: ComponentFixture<DateRangeFilterComponent>;

  const initialRange: DateRange = {startDate: '2026-01-01', endDate: '2026-01-31', label: 'Last Month'};

  beforeEach(async () => {
    // 2026-03-15 local noon -- fixed reference point every preset's date math is asserted against
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));

    await TestBed.configureTestingModule({
      imports: [DateRangeFilterComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(DateRangeFilterComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('dateRange', initialRange);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const clickPreset = (label: string): void => {
    const buttons = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-button');
    const target = buttons.find((b: any): boolean => b.componentInstance.label === label);
    target!.nativeElement.querySelector('button').click();
    fixture.detectChanges();
  };

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('preset selection', () => {
    it('"This Month" should span from the 1st of the current month through today', () => {
      // act
      clickPreset('This Month');

      // assert & verify
      expect(component.dateRange()).toEqual({startDate: '2026-03-01', endDate: '2026-03-15', label: 'This Month'});
    });

    it('"Last Month" should span the full previous calendar month', () => {
      // act
      clickPreset('Last Month');

      // assert & verify -- 2026 is not a leap year, so Feb ends on the 28th
      expect(component.dateRange()).toEqual({startDate: '2026-02-01', endDate: '2026-02-28', label: 'Last Month'});
    });

    it('"Last 3 Months" should span from exactly 3 calendar months ago through today', () => {
      // act
      clickPreset('Last 3 Months');

      // assert & verify -- March minus 3 months rolls back across the year boundary
      expect(component.dateRange()).toEqual({startDate: '2025-12-15', endDate: '2026-03-15', label: 'Last 3 Months'});
    });

    it('"YTD" should span from January 1st of the current year through today', () => {
      // act
      clickPreset('YTD');

      // assert & verify -- the preset's own display label differs from its button label
      expect(component.dateRange()).toEqual({startDate: '2026-01-01', endDate: '2026-03-15', label: 'Year to Date'});
    });

    it('"Last Year" should span the full previous calendar year', () => {
      // act
      clickPreset('Last Year');

      // assert & verify
      expect(component.dateRange()).toEqual({startDate: '2025-01-01', endDate: '2025-12-31', label: 'Last Year'});
    });

    it('should mark only the currently-active preset button as filled/primary', () => {
      // arrange & act
      fixture.componentRef.setInput('dateRange', {startDate: '2026-02-01', endDate: '2026-02-28', label: 'Last Month'});
      fixture.detectChanges();
      const buttons = fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-button');
      const active: any = buttons.find((b: any): boolean => b.componentInstance.label === 'Last Month');
      const inactive: any = buttons.find((b: any): boolean => b.componentInstance.label === 'YTD');

      // assert & verify
      expect(active.componentInstance.text).toBe(false);
      expect(active.componentInstance.severity).toBe('primary');
      expect(inactive.componentInstance.text).toBe(true);
      expect(inactive.componentInstance.severity).toBe('secondary');
    });
  });

  describe('custom range selection', () => {
    // The real p-datePicker calendar-UI interaction is already covered end-to-end by
    // e2e/reports.spec.ts (PF-336). This drives the same seam PrimeNG's own (onSelect) handler
    // drives -- the internal `selectedRange` buffer -- to verify this component's own
    // value-shaping logic (real behavior, not a snapshot of PrimeNG's overlay markup).
    it('should emit a Custom Range once both a start and end date are selected', () => {
      // act
      (component as any).selectedRange.set([new Date(2026, 5, 1), new Date(2026, 5, 10)]);
      (component as any).onDateSelect();

      // assert & verify
      expect(component.dateRange()).toEqual({startDate: '2026-06-01', endDate: '2026-06-10', label: 'Custom Range'});
    });

    it('should not emit while only the start date has been picked', () => {
      // act
      (component as any).selectedRange.set([new Date(2026, 5, 1), null]);
      (component as any).onDateSelect();

      // assert & verify -- the model is untouched, still the original input
      expect(component.dateRange()).toEqual(initialRange);
    });

    it('should not emit when the buffer has been cleared', () => {
      // act
      (component as any).selectedRange.set(null);
      (component as any).onDateSelect();

      // assert & verify
      expect(component.dateRange()).toEqual(initialRange);
    });
  });

  describe('external model sync', () => {
    it('should sync the internal date-picker buffer whenever the model changes externally', () => {
      // act
      fixture.componentRef.setInput('dateRange', {startDate: '2026-05-01', endDate: '2026-05-20', label: 'Custom Range'});
      fixture.detectChanges();

      // assert & verify
      const buffer = (component as any).selectedRange();
      expect(buffer).toEqual([new Date(2026, 4, 1), new Date(2026, 4, 20)]);
    });
  });
});
