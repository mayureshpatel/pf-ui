import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeptCardComponent } from './kept-card.component';

describe('KeptCardComponent', () => {
  let fixture: ComponentFixture<KeptCardComponent>;
  let component: KeptCardComponent;

  function setInputs(values: {
    income: number;
    expense: number;
    previousIncome: number;
    previousExpense: number;
    savingsRate: number;
  }): void {
    for (const [name, value] of Object.entries(values)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  function query<T extends HTMLElement>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [KeptCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(KeptCardComponent);
    component = fixture.componentInstance;
  });

  describe('kept amount', () => {
    it('should be income minus expense', () => {
      // act
      setInputs({
        income: 6400,
        expense: 4558,
        previousIncome: 6000,
        previousExpense: 4400,
        savingsRate: 28.8,
      });

      // assert & verify
      expect(component.kept()).toBe(1842);
      expect(component.isNegative()).toBe(false);
    });

    it('should round away floating point noise to whole cents', () => {
      // act -- 0.3 - 0.1 is 0.19999999999999998 in raw floating point
      setInputs({
        income: 0.3,
        expense: 0.1,
        previousIncome: 0,
        previousExpense: 0,
        savingsRate: 66.7,
      });

      // assert & verify
      expect(component.kept()).toBe(0.2);
    });

    it('should flag a negative amount when expenses exceed income', () => {
      // act
      setInputs({
        income: 1000,
        expense: 1500,
        previousIncome: 1000,
        previousExpense: 900,
        savingsRate: -50,
      });

      // assert & verify
      expect(component.kept()).toBe(-500);
      expect(component.isNegative()).toBe(true);
      expect(query('[data-testid="kept-amount"]').className).toContain('text-rose-600');
    });
  });

  describe('savings rate pill and bar', () => {
    it('should not show a negative savings rate in the healthy colour', () => {
      // act
      setInputs({
        income: 1000,
        expense: 1500,
        previousIncome: 1000,
        previousExpense: 900,
        savingsRate: -50,
      });

      // assert & verify
      const pill = query('[data-testid="kept-rate"]');
      expect(pill.textContent?.trim()).toBe('-50.0% of income');
      expect(pill.className).toContain('text-rose-600');
      expect(pill.className).not.toContain('text-primary');
    });

    it('should show the rate as a share of income and size the bar to it', () => {
      // act
      setInputs({
        income: 6400,
        expense: 4558,
        previousIncome: 0,
        previousExpense: 0,
        savingsRate: 28.8,
      });

      // assert & verify
      expect(query('[data-testid="kept-rate"]').textContent?.trim()).toBe('28.8% of income');
      expect(component.barWidth()).toBe(28.8);
    });

    it('should show "No income" and an empty bar when there is no income', () => {
      // act
      setInputs({
        income: 0,
        expense: 200,
        previousIncome: 0,
        previousExpense: 0,
        savingsRate: 0,
      });

      // assert & verify
      expect(query('[data-testid="kept-rate"]').textContent?.trim()).toBe('No income');
      expect(component.barWidth()).toBe(0);
    });

    it('should clamp a rate above 100 and below 0', () => {
      // act
      setInputs({
        income: 100,
        expense: 0,
        previousIncome: 0,
        previousExpense: 0,
        savingsRate: 140,
      });
      // assert & verify
      expect(component.barWidth()).toBe(100);

      // act
      setInputs({
        income: 100,
        expense: 300,
        previousIncome: 0,
        previousExpense: 0,
        savingsRate: -200,
      });
      // assert & verify
      expect(component.barWidth()).toBe(0);
    });

    it('should expose the bar as a labelled progressbar', () => {
      // act
      setInputs({
        income: 6400,
        expense: 4558,
        previousIncome: 0,
        previousExpense: 0,
        savingsRate: 28.8,
      });

      // assert & verify
      const bar = query('[role="progressbar"]');
      expect(bar.getAttribute('aria-label')).toBe('Savings rate');
      expect(bar.getAttribute('aria-valuenow')).toBe('28.8');
      expect(bar.getAttribute('aria-valuemin')).toBe('0');
      expect(bar.getAttribute('aria-valuemax')).toBe('100');
    });
  });

  describe('change against the previous period', () => {
    it('should say more when the kept amount rose', () => {
      // act -- kept 1842 vs 1600
      setInputs({
        income: 6400,
        expense: 4558,
        previousIncome: 6000,
        previousExpense: 4400,
        savingsRate: 28.8,
      });

      // assert & verify
      expect(component.change()).toBe(242);
      expect(query('[data-testid="kept-change"]').textContent).toContain('more than last period');
    });

    it('should say less when the kept amount fell', () => {
      // act -- kept 1842 vs 2500
      setInputs({
        income: 6400,
        expense: 4558,
        previousIncome: 7000,
        previousExpense: 4500,
        savingsRate: 28.8,
      });

      // assert & verify
      expect(component.change()).toBe(-658);
      expect(query('[data-testid="kept-change"]').textContent).toContain('less than last period');
    });

    it('should say the same when nothing changed', () => {
      // act
      setInputs({
        income: 100,
        expense: 40,
        previousIncome: 100,
        previousExpense: 40,
        savingsRate: 60,
      });

      // assert & verify
      expect(query('[data-testid="kept-change"]').textContent).toContain('Same as last period');
    });

    it('should compare against zero when the previous period had no activity', () => {
      // act
      setInputs({
        income: 500,
        expense: 100,
        previousIncome: 0,
        previousExpense: 0,
        savingsRate: 80,
      });

      // assert & verify -- no NaN, no throw
      expect(component.change()).toBe(400);
      expect(query('[data-testid="kept-change"]').textContent).toContain('more than last period');
      expect(fixture.nativeElement.textContent).not.toContain('NaN');
    });
  });
});
