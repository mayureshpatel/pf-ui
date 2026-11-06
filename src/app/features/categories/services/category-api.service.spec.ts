import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { CategoryApiService } from './category-api.service';

describe('CategoryApiService', () => {
  let service: CategoryApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      ],
    });
    service = TestBed.inject(CategoryApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should post the groups to the batch endpoint, return the result and keep the generic toast off', () => {
    // arrange
    const request = {
      groups: [{ name: 'Food', type: 'EXPENSE', color: '#3B82F6', subcategories: ['Coffee'] }],
    };
    const result = { createdCount: 2, createdParents: 1, createdSubcategories: 1, skipped: [] };
    let received: unknown;

    // act
    service.createCategoriesBatch(request).subscribe((r) => (received = r));
    const req = http.expectOne((r) => r.url.endsWith('/categories/batch'));
    req.flush(result);

    // assert & verify
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    expect(received).toEqual(result);
  });
});
