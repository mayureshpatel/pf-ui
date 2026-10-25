import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@env';
import { TransactionApiService } from './transaction-api.service';
import { PageResponse, Transaction, TransactionFilter } from '@models/transaction.model';

import { Category } from '@models/category.model';

describe('TransactionApiService', () => {
  let service: TransactionApiService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/transactions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TransactionApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TransactionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getTransactions', () => {
    it("should send the filter's local calendar date, not a UTC-shifted one, for a positive-UTC-offset user (PF-199)", () => {
      // Arrange -- a moment where the local calendar date (March 15) differs from the UTC one
      // (March 14). toISOString() is deliberately left un-mocked; getFullYear/getMonth/getDate
      // are mocked to simulate what a real positive-UTC-offset browser's local getters report.
      const startDate = new Date(Date.UTC(2026, 2, 14, 15, 30, 0));
      vi.spyOn(startDate, 'getFullYear').mockReturnValue(2026);
      vi.spyOn(startDate, 'getMonth').mockReturnValue(2);
      vi.spyOn(startDate, 'getDate').mockReturnValue(15);

      const filter: TransactionFilter = { startDate, endDate: startDate };

      // Act
      service.getTransactions(filter, { page: 0, size: 20 }).subscribe();

      // Assert -- must match the local getters (2026-03-15), not toISOString's UTC date
      const req = httpMock.expectOne((r) => r.url === apiUrl);
      expect(req.request.params.get('startDate')).toBe('2026-03-15');
      expect(req.request.params.get('endDate')).toBe('2026-03-15');
      req.flush({ content: [], totalElements: 0 } as unknown as PageResponse<Transaction>);
    });

    it("should send the merchant filter as vendorName, matching the backend's actual query param (PF-810)", () => {
      // Arrange -- the backend's TransactionCrudController.getTransactions binds a `vendorName`
      // query param (confirmed live against the real running server during PF-810); this filter
      // was previously sent as `merchantCleanName`, which the backend silently ignored, so this
      // search has never actually filtered anything.
      const filter: TransactionFilter = { merchant: 'Whole Foods' };

      // Act
      service.getTransactions(filter, { page: 0, size: 20 }).subscribe();

      // Assert
      const req = httpMock.expectOne((r) => r.url === apiUrl);
      expect(req.request.params.get('vendorName')).toBe('Whole Foods');
      expect(req.request.params.get('merchantCleanName')).toBeNull();
      req.flush({ content: [], totalElements: 0 } as unknown as PageResponse<Transaction>);
    });
  });

  describe('getCountsByCategory', () => {
    it("should flatten the backend's { category, transactionCount } rows into categories carrying their own count", () => {
      // arrange
      let result: Category[] = [];

      // act
      service.getCountsByCategory().subscribe((counts) => (result = counts));
      const req = httpMock.expectOne((r) => r.url === `${apiUrl}/count-by-category`);
      req.flush([
        { category: { id: 322, name: 'Groceries', parent: { id: 321 } }, transactionCount: 3 },
        { category: { id: 329, name: 'Paycheck', parent: null }, transactionCount: 2 },
      ]);

      // assert & verify
      expect(result.map((c) => [c.id, c.transactionCount])).toEqual([
        [322, 3],
        [329, 2],
      ]);
      expect(result[0].name).toBe('Groceries');
    });
  });

  describe('getDescriptions', () => {
    it('should send search, unlinkedOnly, page and size and omit empty ones', () => {
      // arrange & act
      service
        .getDescriptions({ search: 'cost', unlinkedOnly: true, page: 2, size: 20 })
        .subscribe();

      // assert & verify
      const req = httpMock.expectOne((r) => r.url === `${apiUrl}/descriptions`);
      expect(req.request.params.get('search')).toBe('cost');
      expect(req.request.params.get('unlinkedOnly')).toBe('true');
      expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('size')).toBe('20');
      req.flush({ content: [], page: { totalElements: 0, totalPages: 0, number: 2, size: 20 } });
    });

    it('should leave out a blank search and unlinkedOnly when false', () => {
      // arrange & act
      service.getDescriptions({ search: '  ', page: 0, size: 1 }).subscribe();

      // assert & verify
      const req = httpMock.expectOne((r) => r.url === `${apiUrl}/descriptions`);
      expect(req.request.params.has('search')).toBe(false);
      expect(req.request.params.has('unlinkedOnly')).toBe(false);
      req.flush({ content: [], page: { totalElements: 0, totalPages: 0, number: 0, size: 1 } });
    });
  });
});
