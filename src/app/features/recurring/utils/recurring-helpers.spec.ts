import { RecurringFrequency, RecurringTransaction } from '@models/recurring.model';
import {
  comingUp,
  confidenceLabel,
  expectedText,
  FREQUENCY_LABELS,
  groupByFrequency,
  monthlyEquivalent,
  priceChangeText,
  totals,
} from './recurring-helpers';

const NOW = new Date(2026, 9, 24);

const item = (
  id: number,
  name: string,
  amount: number,
  frequency: RecurringFrequency,
  nextDate: string,
  over: Partial<RecurringTransaction> = {},
): RecurringTransaction =>
  ({
    id,
    userId: 1,
    account: { id: 1, name: 'Checking' },
    merchant: { id: id, name },
    amount,
    frequency,
    nextDate,
    active: true,
    ...over,
  }) as RecurringTransaction;

describe('recurring helpers', () => {
  describe('monthlyEquivalent', () => {
    it('should convert every frequency to a monthly cost rounded to cents', () => {
      expect(monthlyEquivalent(10, 'WEEKLY')).toBe(43.33);
      expect(monthlyEquivalent(10, 'BI_WEEKLY')).toBe(21.67);
      expect(monthlyEquivalent(10, 'MONTHLY')).toBe(10);
      expect(monthlyEquivalent(135, 'QUARTERLY')).toBe(45);
      expect(monthlyEquivalent(139, 'YEARLY')).toBe(11.58);
    });
  });

  describe('groupByFrequency', () => {
    const items = [
      item(1, 'Netflix', 22.99, 'MONTHLY', '2026-11-03'),
      item(2, 'Rent', 1500, 'MONTHLY', '2026-11-01'),
      item(3, 'Prime', 139, 'YEARLY', '2027-03-14'),
      item(4, 'Gym', 40, 'MONTHLY', '2026-11-05', { active: false }),
      item(5, 'Water', 135, 'QUARTERLY', '2026-12-02', { projectedNextDate: '2026-11-20' }),
    ];

    it('should order groups weekly to yearly and put Paused last', () => {
      // act
      const groups = groupByFrequency(items);

      // assert & verify
      expect(groups.map((g) => g.key)).toEqual(['MONTHLY', 'QUARTERLY', 'YEARLY', 'PAUSED']);
      expect(groups.map((g) => g.label)).toEqual(['Monthly', 'Quarterly', 'Yearly', 'Paused']);
    });

    it('should total each group as a monthly equivalent and leave Paused without a total', () => {
      // act
      const groups = groupByFrequency(items);

      // assert & verify
      expect(groups[0].monthlyTotal).toBe(1522.99);
      expect(groups[1].monthlyTotal).toBe(45);
      expect(groups[2].monthlyTotal).toBe(11.58);
      expect(groups[3].monthlyTotal).toBeNull();
    });

    it('should order items by their projected next date, falling back to the stored one', () => {
      // act
      const monthly = groupByFrequency(items)[0];

      // assert & verify
      expect(monthly.items.map((i) => i.merchant.name)).toEqual(['Rent', 'Netflix']);
    });

    it('should omit frequencies with no items', () => {
      // act & assert & verify
      expect(groupByFrequency([]).length).toBe(0);
      expect(groupByFrequency([items[0]]).map((g) => g.key)).toEqual(['MONTHLY']);
    });
  });

  describe('totals', () => {
    it('should add the monthly equivalents, a year of them, and the service count, ignoring paused items', () => {
      // arrange
      const items = [
        item(1, 'Rent', 1500, 'MONTHLY', '2026-11-01'),
        item(2, 'Prime', 139, 'YEARLY', '2027-03-14'),
        item(3, 'Gym', 40, 'MONTHLY', '2026-11-05', { active: false }),
      ];

      // act
      const result = totals(items);

      // assert & verify
      expect(result.services).toBe(2);
      expect(result.monthly).toBe(1511.58);
      expect(result.yearly).toBe(18139);
    });
  });

  describe('comingUp', () => {
    it('should list active items by next date up to the limit', () => {
      // arrange
      const items = [
        item(1, 'C', 1, 'MONTHLY', '2026-11-09'),
        item(2, 'A', 1, 'MONTHLY', '2026-11-01'),
        item(3, 'Paused', 1, 'MONTHLY', '2026-10-30', { active: false }),
        item(4, 'B', 1, 'MONTHLY', '2026-11-03'),
        item(5, 'D', 1, 'MONTHLY', '2026-11-20'),
      ];

      // act & assert & verify
      expect(comingUp(items).map((i) => i.merchant.name)).toEqual(['A', 'B', 'C']);
      expect(comingUp(items, 1).map((i) => i.merchant.name)).toEqual(['A']);
    });
  });

  describe('confidenceLabel', () => {
    it('should call 70 and above High and anything lower Medium', () => {
      expect(confidenceLabel(100)).toBe('High');
      expect(confidenceLabel(70)).toBe('High');
      expect(confidenceLabel(69.9)).toBe('Medium');
      expect(confidenceLabel(46)).toBe('Medium');
    });
  });

  describe('priceChangeText', () => {
    it('should name both amounts and the date', () => {
      // act & assert & verify
      expect(priceChangeText({ previousAmount: 10, newAmount: 12, since: '2026-09-03' }, NOW)).toBe(
        'Was $10.00, now $12.00 since Sep 3',
      );
    });

    it('should add the year when the date is in another year', () => {
      // act & assert & verify
      expect(
        priceChangeText({ previousAmount: 9.99, newAmount: 12, since: '2025-09-03' }, NOW),
      ).toBe('Was $9.99, now $12.00 since Sep 3, 2025');
    });
  });

  describe('expectedText', () => {
    it('should say Expected with the date only when the item is overdue', () => {
      // act & assert & verify
      expect(
        expectedText(
          item(1, 'A', 1, 'MONTHLY', '2026-10-01', {
            overdue: true,
            projectedNextDate: '2026-10-28',
          }),
          NOW,
        ),
      ).toBe('Expected Oct 28');
      expect(expectedText(item(1, 'A', 1, 'MONTHLY', '2026-11-01'), NOW)).toBeNull();
    });
  });

  it('should label every frequency', () => {
    expect(FREQUENCY_LABELS).toEqual({
      WEEKLY: 'Weekly',
      BI_WEEKLY: 'Bi-weekly',
      MONTHLY: 'Monthly',
      QUARTERLY: 'Quarterly',
      YEARLY: 'Yearly',
    });
  });
});
