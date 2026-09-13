import { FilterMetadata } from 'primeng/api';
import { TransactionFilter } from '@models/transaction.model';
import {
  setAmountFilter,
  setDateFilter,
  setEqualsFilter,
  setMerchantFilter,
  updateCompositeFilterField,
} from './transaction-filter.util';

describe('transaction-filter.util', () => {
  describe('setEqualsFilter', () => {
    it('should set the field from a single FilterMetadata', () => {
      // Arrange
      const stateFilter: TransactionFilter = {};

      // Act
      setEqualsFilter({ value: 5, matchMode: 'equals' }, stateFilter, 'accountId');

      // Assert & verify
      expect(stateFilter.accountId).toBe(5);
    });

    it('should set the field from the first element of a FilterMetadata array', () => {
      // Arrange
      const stateFilter: TransactionFilter = {};

      // Act
      setEqualsFilter([{ value: 'Dining', matchMode: 'equals' }], stateFilter, 'categoryName');

      // Assert & verify
      expect(stateFilter.categoryName).toBe('Dining');
    });

    it('should clear the field when the metadata value is falsy', () => {
      // Arrange
      const stateFilter: TransactionFilter = { tagId: 3 };

      // Act
      setEqualsFilter({ value: null, matchMode: 'equals' }, stateFilter, 'tagId');

      // Assert & verify
      expect(stateFilter.tagId).toBeUndefined();
    });

    it('should clear the field when the metadata event itself is undefined', () => {
      // Arrange
      const stateFilter: TransactionFilter = { accountId: 5 };

      // Act
      setEqualsFilter(undefined, stateFilter, 'accountId');

      // Assert & verify
      expect(stateFilter.accountId).toBeUndefined();
    });
  });

  describe('setDateFilter', () => {
    it('should set both startDate and endDate to the same value for a dateIs match', () => {
      // Arrange
      const stateFilter: TransactionFilter = {};
      const day = new Date('2026-05-15T00:00:00.000Z');

      // Act
      setDateFilter({ value: day, matchMode: 'dateIs' }, stateFilter);

      // Assert & verify
      expect(stateFilter.startDate).toEqual(day);
      expect(stateFilter.endDate).toEqual(day);
    });

    it('should set only startDate for a dateAfter match and only endDate for a dateBefore match', () => {
      // Arrange
      const stateFilter: TransactionFilter = {};
      const start = new Date('2026-05-01T00:00:00.000Z');
      const end = new Date('2026-05-31T00:00:00.000Z');
      const metadata: FilterMetadata[] = [
        { value: start, matchMode: 'dateAfter' },
        { value: end, matchMode: 'dateBefore' },
      ];

      // Act
      setDateFilter(metadata, stateFilter);

      // Assert & verify
      expect(stateFilter.startDate).toEqual(start);
      expect(stateFilter.endDate).toEqual(end);
    });

    it('should clear both dates when the filter event is falsy', () => {
      // Arrange
      const stateFilter: TransactionFilter = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-02'),
      };

      // Act
      setDateFilter(undefined, stateFilter);

      // Assert & verify
      expect(stateFilter.startDate).toBeUndefined();
      expect(stateFilter.endDate).toBeUndefined();
    });
  });

  describe('setMerchantFilter', () => {
    it('should set both merchant and description from a combined custom filter value', () => {
      // Arrange
      const stateFilter: TransactionFilter = {};

      // Act
      setMerchantFilter(
        { value: { merchant: 'Starbucks', description: 'coffee' }, matchMode: 'custom' },
        stateFilter,
      );

      // Assert & verify
      expect(stateFilter.merchant).toBe('Starbucks');
      expect(stateFilter.description).toBe('coffee');
    });

    it('should clear both fields when the filter event is falsy', () => {
      // Arrange
      const stateFilter: TransactionFilter = { merchant: 'Starbucks', description: 'coffee' };

      // Act
      setMerchantFilter(undefined, stateFilter);

      // Assert & verify
      expect(stateFilter.merchant).toBeUndefined();
      expect(stateFilter.description).toBeUndefined();
    });
  });

  describe('setAmountFilter', () => {
    it('should set minAmount, maxAmount, and type from a combined custom filter value', () => {
      // Arrange
      const stateFilter: TransactionFilter = {};

      // Act
      setAmountFilter(
        { value: { min: 5, max: 50, type: 'EXPENSE' }, matchMode: 'custom' },
        stateFilter,
      );

      // Assert & verify
      expect(stateFilter.minAmount).toBe(5);
      expect(stateFilter.maxAmount).toBe(50);
      expect(stateFilter.type).toBe('EXPENSE');
    });

    it('should preserve a min or max of exactly 0', () => {
      // Arrange
      const stateFilter: TransactionFilter = {};

      // Act
      setAmountFilter(
        { value: { min: 0, max: null, type: null }, matchMode: 'custom' },
        stateFilter,
      );

      // Assert & verify
      expect(stateFilter.minAmount).toBe(0);
    });

    it('should clear all three fields when the filter event is falsy', () => {
      // Arrange
      const stateFilter: TransactionFilter = { minAmount: 5, maxAmount: 50 };

      // Act
      setAmountFilter(undefined, stateFilter);

      // Assert & verify
      expect(stateFilter.minAmount).toBeUndefined();
      expect(stateFilter.maxAmount).toBeUndefined();
      expect(stateFilter.type).toBeUndefined();
    });
  });

  describe('updateCompositeFilterField', () => {
    it('should merge the changed field with existing sibling fields', () => {
      // Arrange
      const constraint: FilterMetadata = { value: { min: 5, max: null, type: null } };

      // Act
      updateCompositeFilterField(constraint, ['min', 'max', 'type'], 'max', 50);

      // Assert & verify
      expect(constraint.value).toEqual({ min: 5, max: 50, type: null });
    });

    it('should clear the whole constraint (value = null) once every field is empty, using the default strict-null emptiness check', () => {
      // Arrange
      const constraint: FilterMetadata = { value: { min: null, max: null, type: null } };

      // Act
      updateCompositeFilterField(constraint, ['min', 'max', 'type'], 'min', null);

      // Assert & verify
      expect(constraint.value).toBeNull();
    });

    it('should NOT clear the constraint when a sibling field is 0 (a meaningful amount, not empty)', () => {
      // Arrange -- max is 0, a real filter value, not "unset"
      const constraint: FilterMetadata = { value: { min: null, max: 0, type: null } };

      // Act
      updateCompositeFilterField(constraint, ['min', 'max', 'type'], 'min', null);

      // Assert & verify
      expect(constraint.value).toEqual({ min: null, max: 0, type: null });
    });

    it('should support a custom isEmpty predicate (falsy check) for the merchant/description pair', () => {
      // Arrange
      const constraint: FilterMetadata = { value: { merchant: null, description: '' } };

      // Act -- empty string should count as empty under the falsy predicate
      updateCompositeFilterField(constraint, ['merchant', 'description'], 'description', '', {
        isEmpty: (v: unknown): boolean => !v,
      });

      // Assert & verify
      expect(constraint.value).toBeNull();
    });

    it('should apply a normalize function to the changed value before storing it', () => {
      // Arrange
      const constraint: FilterMetadata = { value: { merchant: 'Starbucks', description: null } };

      // Act -- description gets trimmed
      updateCompositeFilterField(
        constraint,
        ['merchant', 'description'],
        'description',
        '  coffee  ',
        {
          normalize: (v: unknown): unknown => (v as string).trim() || null,
          isEmpty: (v: unknown): boolean => !v,
        },
      );

      // Assert & verify
      expect(constraint.value).toEqual({ merchant: 'Starbucks', description: 'coffee' });
    });

    it('should start from an empty object when the constraint has no prior value', () => {
      // Arrange
      const constraint: FilterMetadata = { value: null };

      // Act
      updateCompositeFilterField(constraint, ['min', 'max', 'type'], 'type', 'EXPENSE');

      // Assert & verify
      expect(constraint.value).toEqual({ min: undefined, max: undefined, type: 'EXPENSE' });
    });
  });
});
