import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PulseCardComponent } from './pulse-card.component';

describe('PulseCardComponent', () => {
  let component: PulseCardComponent;
  let fixture: ComponentFixture<PulseCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PulseCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PulseCardComponent);
    component = fixture.componentInstance;
  });

  function setInputs(overrides: {
    title?: string;
    value: number;
    previousValue: number;
    type?: 'currency' | 'percent';
    inverseTrend?: boolean;
    color?: string | null;
  }): void {
    fixture.componentRef.setInput('title', overrides.title ?? 'Total Income');
    fixture.componentRef.setInput('value', overrides.value);
    fixture.componentRef.setInput('previousValue', overrides.previousValue);
    if (overrides.type !== undefined) fixture.componentRef.setInput('type', overrides.type);
    if (overrides.inverseTrend !== undefined)
      fixture.componentRef.setInput('inverseTrend', overrides.inverseTrend);
    if (overrides.color !== undefined) fixture.componentRef.setInput('color', overrides.color);
    fixture.detectChanges();
  }

  describe('formattedValue', () => {
    it('should format as currency by default', () => {
      // act
      setInputs({ value: 1234.5, previousValue: 1000 });

      // assert & verify
      expect(component.formattedValue()).toBe('$1,234.50');
    });

    it('should format as a percentage when type is percent', () => {
      // act
      setInputs({ value: 33.333, previousValue: 30, type: 'percent' });

      // assert & verify
      expect(component.formattedValue()).toBe('33.3%');
    });
  });

  describe('trend', () => {
    it('should compute a positive percentage change', () => {
      // act
      setInputs({ value: 1200, previousValue: 1000 });

      // assert & verify
      expect(component.trend()).toBe(20);
    });

    it('should compute a negative percentage change', () => {
      // act
      setInputs({ value: 800, previousValue: 1000 });

      // assert & verify
      expect(component.trend()).toBe(-20);
    });

    it('should return 0 when the previous value is 0, avoiding a division by zero', () => {
      // act
      setInputs({ value: 500, previousValue: 0 });

      // assert & verify
      expect(component.trend()).toBe(0);
    });
  });

  describe('trendStyles', () => {
    it('should style a neutral (zero) trend as neutral regardless of inverseTrend', () => {
      // act
      setInputs({ value: 1000, previousValue: 1000 });

      // assert & verify
      expect(component.trendStyles()).toContain('text-surface-500');
    });

    it('should style a positive trend as good when inverseTrend is false (e.g. income)', () => {
      // act
      setInputs({ value: 1200, previousValue: 1000, inverseTrend: false });

      // assert & verify
      expect(component.trendStyles()).toContain('text-emerald-600');
    });

    it('should style a positive trend as bad when inverseTrend is true (e.g. expenses rising)', () => {
      // act
      setInputs({ value: 1200, previousValue: 1000, inverseTrend: true });

      // assert & verify
      expect(component.trendStyles()).toContain('text-rose-600');
    });

    it('should style a negative trend as bad when inverseTrend is false (e.g. income dropping)', () => {
      // act
      setInputs({ value: 800, previousValue: 1000, inverseTrend: false });

      // assert & verify
      expect(component.trendStyles()).toContain('text-rose-600');
    });

    it('should style a negative trend as good when inverseTrend is true (e.g. expenses falling)', () => {
      // act
      setInputs({ value: 800, previousValue: 1000, inverseTrend: true });

      // assert & verify
      expect(component.trendStyles()).toContain('text-emerald-600');
    });
  });

  describe('trendIcon', () => {
    it('should show a minus icon for no change', () => {
      // act
      setInputs({ value: 1000, previousValue: 1000 });

      // assert & verify
      expect(component.trendIcon()).toContain('pi-minus');
    });

    it('should show an up arrow for a positive trend', () => {
      // act
      setInputs({ value: 1200, previousValue: 1000 });

      // assert & verify
      expect(component.trendIcon()).toContain('pi-arrow-up');
    });

    it('should show a down arrow for a negative trend', () => {
      // act
      setInputs({ value: 800, previousValue: 1000 });

      // assert & verify
      expect(component.trendIcon()).toContain('pi-arrow-down');
    });
  });

  describe('rendering', () => {
    it('should render the title and formatted value', () => {
      // act
      setInputs({ title: 'Total Expenses', value: 550, previousValue: 500 });

      // assert & verify
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Total Expenses');
      expect(text).toContain('$550.00');
    });

    it('should render the previous value as currency in the comparison subtext by default', () => {
      // act
      setInputs({ value: 550, previousValue: 500 });

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('vs $500.00 last period');
    });

    it('should render the previous value as a percentage when type is percent', () => {
      // act
      setInputs({ value: 33.3, previousValue: 28.5, type: 'percent' });

      // assert & verify
      expect(fixture.nativeElement.textContent).toContain('vs 28.5% last period');
    });

    it('should apply a custom color class when provided, falling back to a default otherwise', () => {
      // act
      setInputs({ value: 550, previousValue: 500, color: 'text-rose-600' });

      // assert & verify
      const valueEl = fixture.nativeElement.querySelector('.text-3xl');
      expect(valueEl.className).toContain('text-rose-600');
    });
  });
});
