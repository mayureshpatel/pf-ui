import { TestBed } from '@angular/core/testing';
import { Params } from '@angular/router';
import { TransactionUrlStateService } from './transaction-url-state.service';
import { TransactionState, TransactionType } from '@models/transaction.model';

describe('TransactionUrlStateService', () => {
  let service: TransactionUrlStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TransactionUrlStateService);
  });

  describe('hydrateFromParams / buildQueryParams round-trip', () => {
    it('should round-trip a full filter covering all 10 TransactionFilter fields', () => {
      // Arrange
      const state: TransactionState = {
        filter: {
          accountId: 7,
          type: TransactionType.EXPENSE,
          description: 'coffee',
          merchant: 'Starbucks',
          categoryName: 'Dining',
          minAmount: 5,
          maxAmount: 50,
          startDate: new Date('2026-03-01T00:00:00.000Z'),
          endDate: new Date('2026-03-31T00:00:00.000Z'),
          tagId: 42,
        },
        page: 2,
        size: 50,
        sort: 'amount,asc',
      };

      // Act
      const params: Params = service.buildQueryParams(state);
      const rehydrated: TransactionState = service.hydrateFromParams(params);

      // Assert & verify
      expect(rehydrated).toEqual(state);
    });

    it('should round-trip a same-day filter (startDate equal to endDate)', () => {
      // Arrange -- functionally what the UI represents as a single-day "dateIs" filter
      const sameDay = new Date('2026-05-15T00:00:00.000Z');
      const state: TransactionState = {
        filter: { startDate: sameDay, endDate: sameDay },
        page: 0,
        size: 20,
        sort: 'date,desc',
      };

      // Act
      const params: Params = service.buildQueryParams(state);
      const rehydrated: TransactionState = service.hydrateFromParams(params);

      // Assert & verify -- both fields independently present and equal in value
      expect(params['startDate']).toBeDefined();
      expect(params['endDate']).toBeDefined();
      expect(rehydrated.filter.startDate).toEqual(sameDay);
      expect(rehydrated.filter.endDate).toEqual(sameDay);
    });

    it('should omit default page, size, and sort values from the built params', () => {
      // Arrange
      const state: TransactionState = {
        filter: {},
        page: 0,
        size: 20,
        sort: 'date,desc',
      };

      // Act
      const params: Params = service.buildQueryParams(state);

      // Assert & verify
      expect(params['page']).toBeUndefined();
      expect(params['size']).toBeUndefined();
      expect(params['sort']).toBeUndefined();
    });

    it('should include non-default page, size, and sort values in the built params', () => {
      // Arrange
      const state: TransactionState = { filter: {}, page: 3, size: 100, sort: 'amount,asc' };

      // Act
      const params: Params = service.buildQueryParams(state);

      // Assert & verify
      expect(params['page']).toBe(3);
      expect(params['size']).toBe(100);
      expect(params['sort']).toBe('amount,asc');
    });

    it('should omit unset filter fields from the built params entirely', () => {
      // Arrange
      const state: TransactionState = {
        filter: { merchant: 'Starbucks' },
        page: 0,
        size: 20,
        sort: 'date,desc',
      };

      // Act
      const params: Params = service.buildQueryParams(state);

      // Assert & verify
      expect(Object.keys(params)).toEqual(['merchant']);
    });
  });

  describe('hydrateFromParams', () => {
    it('should default page, size, and sort when missing from params', () => {
      // Act
      const state: TransactionState = service.hydrateFromParams({});

      // Assert & verify
      expect(state.page).toBe(0);
      expect(state.size).toBe(20);
      expect(state.sort).toBe('date,desc');
    });

    it('should not throw on malformed numeric params', () => {
      // Act & Assert & verify
      expect(() =>
        service.hydrateFromParams({ accountId: 'not-a-number', minAmount: 'also-not-a-number' }),
      ).not.toThrow();
    });

    it('should produce undefined filter fields when params are missing', () => {
      // Act
      const state: TransactionState = service.hydrateFromParams({});

      // Assert & verify
      expect(state.filter).toEqual({
        accountId: undefined,
        type: undefined,
        description: undefined,
        merchant: undefined,
        categoryName: undefined,
        minAmount: undefined,
        maxAmount: undefined,
        startDate: undefined,
        endDate: undefined,
        tagId: undefined,
      });
    });
  });
});
