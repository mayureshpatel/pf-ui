import {vi} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {provideHttpClient} from '@angular/common/http';
import {environment} from '@env';
import {TransactionApiService} from './transaction-api.service';
import {PageResponse, Transaction, TransactionFilter} from '@models/transaction.model';

describe('TransactionApiService', () => {
  let service: TransactionApiService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/transactions`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TransactionApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(TransactionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getTransactions', () => {
    it('should send the filter\'s local calendar date, not a UTC-shifted one, for a positive-UTC-offset user (PF-199)', () => {
      // Arrange -- a moment where the local calendar date (March 15) differs from the UTC one
      // (March 14). toISOString() is deliberately left un-mocked; getFullYear/getMonth/getDate
      // are mocked to simulate what a real positive-UTC-offset browser's local getters report.
      const startDate = new Date(Date.UTC(2026, 2, 14, 15, 30, 0));
      vi.spyOn(startDate, 'getFullYear').mockReturnValue(2026);
      vi.spyOn(startDate, 'getMonth').mockReturnValue(2);
      vi.spyOn(startDate, 'getDate').mockReturnValue(15);

      const filter: TransactionFilter = {startDate, endDate: startDate};

      // Act
      service.getTransactions(filter, {page: 0, size: 20}).subscribe();

      // Assert -- must match the local getters (2026-03-15), not toISOString's UTC date
      const req = httpMock.expectOne(r => r.url === apiUrl);
      expect(req.request.params.get('startDate')).toBe('2026-03-15');
      expect(req.request.params.get('endDate')).toBe('2026-03-15');
      req.flush({content: [], totalElements: 0} as unknown as PageResponse<Transaction>);
    });
  });
});
