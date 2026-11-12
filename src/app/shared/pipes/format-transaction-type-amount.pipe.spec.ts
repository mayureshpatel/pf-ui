import { TestBed } from '@angular/core/testing';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { FormatTransactionTypeAmountPipe } from './format-transaction-type-amount.pipe';

describe('FormatTransactionTypeAmountPipe', () => {
  let pipe: FormatTransactionTypeAmountPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FormatCurrencyPipe] });
    pipe = TestBed.runInInjectionContext(() => new FormatTransactionTypeAmountPipe());
  });

  it('should sign income as a plus and expense as a minus', () => {
    // act & assert & verify
    expect(pipe.transform(10, 'INCOME')).toBe('+$10.00');
    expect(pipe.transform(10, 'EXPENSE')).toBe('-$10.00');
  });

  it.each(['CONTRIBUTION', 'EMPLOYER_CONTRIBUTION', 'EARNINGS'])(
    'should show %s as an inflow with a plus sign',
    (type: string) => {
      // act & assert & verify
      expect(pipe.transform(500, type)).toBe('+$500.00');
    },
  );
});
