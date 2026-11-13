import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PulseCardComponent } from './pulse-card.component';

describe('PulseCardComponent', () => {
  let component: PulseCardComponent;
  let fixture: ComponentFixture<PulseCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PulseCardComponent],
      providers: [provideRouter([])],
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
      expect(component.trendStyles()).toContain('text-muted-color');
    });

    it('should style a positive trend as good when inverseTrend is false (e.g. income)', () => {
      // act
      setInputs({ value: 1200, previousValue: 1000, inverseTrend: false });

      // assert & verify
      expect(component.trendStyles()).toContain('text-emerald-700');
    });

    it('should style a positive trend as bad when inverseTrend is true (e.g. expenses rising)', () => {
      // act
      setInputs({ value: 1200, previousValue: 1000, inverseTrend: true });

      // assert & verify
      expect(component.trendStyles()).toContain('text-rose-700');
    });

    it('should style a negative trend as bad when inverseTrend is false (e.g. income dropping)', () => {
      // act
      setInputs({ value: 800, previousValue: 1000, inverseTrend: false });

      // assert & verify
      expect(component.trendStyles()).toContain('text-rose-700');
    });

    it('should style a negative trend as good when inverseTrend is true (e.g. expenses falling)', () => {
      // act
      setInputs({ value: 800, previousValue: 1000, inverseTrend: true });

      // assert & verify
      expect(component.trendStyles()).toContain('text-emerald-700');
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

  describe('delta line', () => {
    function delta(): HTMLElement {
      return fixture.nativeElement.querySelector('[data-testid="pulse-delta"]');
    }

    it('should state the percentage change and the prior value in one flat line', () => {
      // act
      setInputs({ value: 1200, previousValue: 1000 });

      // assert & verify
      expect(delta().textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Up 20% vs $1,000.00 last period',
      );
    });

    it('should say there is no prior period instead of 0% when the previous value is 0', () => {
      // act
      setInputs({ value: 500, previousValue: 0 });

      // assert & verify
      const text: string = delta().textContent ?? '';
      expect(text).toContain('No prior period to compare');
      expect(text).not.toContain('0%');
      expect(delta().querySelector('i')).toBeNull();
    });

    it('should say no change when the value equals a non-zero previous value', () => {
      // act
      setInputs({ value: 1000, previousValue: 1000 });

      // assert & verify
      expect(delta().textContent).toContain('No change vs $1,000.00 last period');
    });

    it('should show one decimal for a change that would round to 0%', () => {
      // act -- $6,313.59 against $6,299.82 is +0.2%, which "Up 0%" would hide
      setInputs({ value: 6313.59, previousValue: 6299.82 });

      // assert & verify
      expect(delta().textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Up 0.2% vs $6,299.82 last period',
      );
    });

    it('should show one decimal for a small drop, and still name the direction', () => {
      // act
      setInputs({ value: 995, previousValue: 1000 });

      // assert & verify
      expect(delta().textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Down 0.5% vs $1,000.00 last period',
      );
    });

    it('should call a change too small to see no change, not a 0.0% move', () => {
      // act -- +0.01%
      setInputs({ value: 1000.1, previousValue: 1000 });

      // assert & verify
      expect(delta().textContent).toContain('No change vs $1,000.00 last period');
      expect(delta().querySelector('.sr-only')).toBeNull();
    });

    it('should keep whole percentages for changes of 1% or more', () => {
      // act
      setInputs({ value: 1015, previousValue: 1000 });

      // assert & verify
      expect(delta().textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Up 2% vs $1,000.00 last period',
      );
    });

    it('should not render a filled or ringed pill', () => {
      // act
      setInputs({ value: 1200, previousValue: 1000 });

      // assert & verify
      expect(fixture.nativeElement.querySelector('.rounded-full')).toBeNull();
      expect(fixture.nativeElement.querySelector('.ring-1')).toBeNull();
    });

    it('should name the direction for assistive tech, not just show an arrow', () => {
      // act
      setInputs({ value: 800, previousValue: 1000 });

      // assert & verify
      expect(delta().querySelector('.sr-only')?.textContent).toContain('Down');
    });
  });

  describe('drill-down link', () => {
    it('should render no link when no link params are given', () => {
      // act
      setInputs({ value: 100, previousValue: 90 });

      // assert & verify
      expect(fixture.nativeElement.querySelector('a')).toBeNull();
    });

    it('should wrap the card in a link to the transactions behind the number', () => {
      // act
      fixture.componentRef.setInput('link', {
        type: 'INCOME',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      });
      setInputs({ title: 'Income', value: 100, previousValue: 90 });

      // assert & verify
      const anchor: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
      expect(anchor.getAttribute('href')).toBe(
        '/transactions?type=INCOME&startDate=2026-05-01&endDate=2026-05-31',
      );
      expect(anchor.getAttribute('aria-label')).toBe('Income: view transactions');
      expect(anchor.textContent).toContain('$100.00');
    });
  });

  describe('figure fit (real layout; skipped where the test runner has none)', () => {
    /** jsdom has no layout engine, so these checks only mean something in a real browser. */
    function hasLayout(): boolean {
      const probe: HTMLDivElement = document.createElement('div');
      probe.style.cssText = 'position:absolute;width:100px;height:10px';
      document.body.appendChild(probe);
      const laidOut: boolean = probe.offsetWidth === 100;
      probe.remove();
      return laidOut;
    }

    function overflow(widthPx: number, value: number): number {
      fixture.nativeElement.style.display = 'block';
      fixture.nativeElement.style.width = `${widthPx}px`;
      setInputs({ value, previousValue: value });
      const amount: HTMLElement = fixture.nativeElement.querySelector(
        '[data-testid="pulse-amount"]',
      );
      const range: Range = document.createRange();
      range.selectNodeContents(amount);
      // how far the text runs past the right edge of the figure's own box
      return Math.round(range.getBoundingClientRect().right - amount.getBoundingClientRect().right);
    }

    // 143px is what a card held at 851px wide before the layout change; 174px is the narrowest
    // card the figure has been shown in
    it.each([
      [143, 61575.69],
      [174, 61575.69],
      [174, 1234567.89],
      [174, 53873.14],
      [230, 1234567.89],
    ])('should keep a figure inside a %ipx-wide card: %f', (width: number, value: number) => {
      // arrange
      if (!hasLayout()) {
        return;
      }

      // act
      const past: number = overflow(width, value);

      // assert & verify
      expect(past).toBeLessThanOrEqual(0);
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
      const valueEl = fixture.nativeElement.querySelector('[data-testid="pulse-amount"]');
      expect(valueEl.className).toContain('text-rose-600');
    });
  });
});
