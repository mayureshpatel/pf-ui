import { ComponentFixture, TestBed } from '@angular/core/testing';
import { YtdSummaryComponent } from './ytd-summary.component';

describe('YtdSummaryComponent', () => {
  let component: YtdSummaryComponent;
  let fixture: ComponentFixture<YtdSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YtdSummaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(YtdSummaryComponent);
    component = fixture.componentInstance;
  });

  function setInputs(
    year: number,
    totalIncome: number,
    totalExpense: number,
    avgSavingsRate: number,
  ): void {
    fixture.componentRef.setInput('year', year);
    fixture.componentRef.setInput('totalIncome', totalIncome);
    fixture.componentRef.setInput('totalExpense', totalExpense);
    fixture.componentRef.setInput('avgSavingsRate', avgSavingsRate);
    fixture.detectChanges();
  }

  it('should render the year, income, and expenses as received', () => {
    // act
    setInputs(2026, 12000, 8000, 33.3);

    // assert & verify
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('2026 Summary');
    expect(text).toContain('$12,000.00');
    expect(text).toContain('$8,000.00');
  });

  describe('netSavings', () => {
    it('should compute income minus expense, not just display a passed-in value', () => {
      // act
      setInputs(2026, 12000, 8000, 33.3);

      // assert & verify
      expect(component.netSavings()).toBe(4000);
      expect(fixture.nativeElement.textContent).toContain('$4,000.00');
    });

    it('should go negative when expenses exceed income', () => {
      // act
      setInputs(2026, 5000, 9000, -80);

      // assert & verify
      expect(component.netSavings()).toBe(-4000);
    });
  });

  describe('savingsRateStyles', () => {
    it('should use the emerald (strong) tier at 20% or above', () => {
      // act
      setInputs(2026, 10000, 8000, 20);

      // assert & verify
      expect(component.savingsRateStyles()).toContain('text-emerald-600');
    });

    it('should use the amber (moderate) tier between 0 and 20%', () => {
      // act
      setInputs(2026, 10000, 9000, 10);

      // assert & verify
      expect(component.savingsRateStyles()).toContain('text-amber-600');
    });

    it('should use the rose (poor) tier at 0% or below', () => {
      // act
      setInputs(2026, 8000, 10000, -25);

      // assert & verify
      expect(component.savingsRateStyles()).toContain('text-rose-600');
    });

    it('should treat exactly 0% as the rose tier, not amber', () => {
      // act
      setInputs(2026, 10000, 10000, 0);

      // assert & verify
      expect(component.savingsRateStyles()).toContain('text-rose-600');
    });
  });

  it('should clamp the progress bar width to 100% even when the rate exceeds it', () => {
    // act
    setInputs(2026, 20000, 1000, 150);

    // assert & verify
    const bar = fixture.nativeElement.querySelector('.bg-primary.h-full');
    expect(bar.style.width).toBe('100%');
  });

  it('should clamp the progress bar width to 0% for a negative rate, not a negative width', () => {
    // act
    setInputs(2026, 5000, 9000, -80);

    // assert & verify
    const bar = fixture.nativeElement.querySelector('.bg-primary.h-full');
    expect(bar.style.width).toBe('0%');
  });
});
