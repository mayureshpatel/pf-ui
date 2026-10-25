import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@env';
import { ReportApiService } from './report-api.service';
import { defaultState } from '../utils/explore-state';
import { ExploreState } from '../models/reports.model';

describe('ReportApiService (explorer)', () => {
  let service: ReportApiService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/reports`;
  const state: ExploreState = {
    ...defaultState(new Date(2026, 9, 25)),
    compare: 'SAME_DAYS_LAST_YEAR',
    filters: { accountIds: [1, 2], categoryId: 5, categoryName: 'Food' },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReportApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ReportApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should explore with the grouping, range, comparison and filters', () => {
    // act
    service.explore(state).subscribe();

    // assert & verify
    const req = httpMock.expectOne((r) => r.url === `${apiUrl}/explore`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('measure')).toBe('SPENDING');
    expect(req.request.params.get('groupBy')).toBe('CATEGORY');
    expect(req.request.params.get('startDate')).toBe('2026-01-01');
    expect(req.request.params.get('compare')).toBe('SAME_DAYS_LAST_YEAR');
    expect(req.request.params.get('accountIds')).toBe('1,2');
    expect(req.request.params.get('categoryId')).toBe('5');
    expect(req.request.params.has('categoryName')).toBe(false);
    req.flush({ rows: [] });
  });

  it('should ask for the trend without a grouping', () => {
    // act
    service.trend(state).subscribe();

    // assert & verify
    const req = httpMock.expectOne((r) => r.url === `${apiUrl}/explore/trend`);
    expect(req.request.params.has('groupBy')).toBe(false);
    expect(req.request.params.get('measure')).toBe('SPENDING');
    expect(req.request.params.get('compare')).toBe('SAME_DAYS_LAST_YEAR');
    req.flush({ current: [], comparison: [] });
  });

  it('should page the transactions behind the number without a grouping or comparison', () => {
    // act
    service.transactions(state, 2, 20).subscribe();

    // assert & verify
    const req = httpMock.expectOne((r) => r.url === `${apiUrl}/explore/transactions`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('groupBy')).toBe(false);
    expect(req.request.params.has('compare')).toBe(false);
    expect(req.request.params.get('categoryId')).toBe('5');
    req.flush({ content: [], page: { totalElements: 0, totalPages: 0, number: 2, size: 20 } });
  });
});
