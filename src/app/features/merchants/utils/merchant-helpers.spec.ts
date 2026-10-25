import { Merchant, TransactionDescription } from '@models/merchant.model';
import {
  isMovingLink,
  linksLabel,
  locationLabel,
  merchantCountLabel,
  unlinkedLabel,
} from './merchant-helpers';

const merchant = (city: string | null, state: string | null): Merchant =>
  ({
    id: 1,
    userId: 1,
    name: 'Amazon',
    city,
    state,
    postalCode: null,
    country: null,
    linkCount: 0,
  }) as Merchant;

const row = (merchantId: number | null): TransactionDescription => ({
  description: 'AMZN MKTP',
  transactionCount: 4,
  merchantId,
  merchantName: merchantId === null ? null : 'Amazon',
});

describe('merchant helpers', () => {
  describe('locationLabel', () => {
    it('should join city and state', () => {
      expect(locationLabel(merchant('Seattle', 'WA'))).toBe('Seattle, WA');
    });

    it('should show just the city or just the state', () => {
      expect(locationLabel(merchant('Seattle', null))).toBe('Seattle');
      expect(locationLabel(merchant(null, 'WA'))).toBe('WA');
    });

    it('should say No location when neither is given or both are blank', () => {
      expect(locationLabel(merchant(null, null))).toBe('No location');
      expect(locationLabel(merchant('  ', ''))).toBe('No location');
    });
  });

  describe('linksLabel', () => {
    it('should handle none, one and many', () => {
      expect(linksLabel(0)).toBe('No links');
      expect(linksLabel(1)).toBe('1 link');
      expect(linksLabel(12)).toBe('12 links');
    });
  });

  describe('merchantCountLabel', () => {
    it('should handle one and many', () => {
      expect(merchantCountLabel(1)).toBe('1 merchant');
      expect(merchantCountLabel(312)).toBe('312 merchants');
    });
  });

  describe('unlinkedLabel', () => {
    it('should say every description is linked at zero', () => {
      expect(unlinkedLabel(0)).toBe('Every transaction description is linked.');
    });

    it('should handle one and many', () => {
      expect(unlinkedLabel(1)).toBe("1 transaction description isn't linked to a merchant.");
      expect(unlinkedLabel(47)).toBe("47 transaction descriptions aren't linked to a merchant.");
    });
  });

  describe('isMovingLink', () => {
    it('should be false for an unlinked description', () => {
      expect(isMovingLink(row(null), 5)).toBe(false);
    });

    it('should be false when already linked to the target merchant', () => {
      expect(isMovingLink(row(5), 5)).toBe(false);
    });

    it('should be true when linked to a different merchant', () => {
      expect(isMovingLink(row(7), 5)).toBe(true);
    });

    it('should be true for a linked description when no target is chosen yet', () => {
      expect(isMovingLink(row(7), null)).toBe(true);
    });
  });
});
