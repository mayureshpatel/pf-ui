import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@env';
import { AuthService } from '@core/auth/auth.service';
import { CategoryRuleApiService } from './category-rule-api.service';

describe('CategoryRuleApiService', () => {
  let service: CategoryRuleApiService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/category-rules`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CategoryRuleApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => ({ id: 42 }) } },
      ],
    });
    service = TestBed.inject(CategoryRuleApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should list rules', () => {
    // act
    service.getRules().subscribe();

    // assert & verify
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it("should create a rule with the user's id", () => {
    // act
    service.createRule({ keywords: ['netflix'], categoryId: 5, priority: 0 } as never).subscribe();

    // assert & verify
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      keywords: ['netflix'],
      categoryId: 5,
      priority: 0,
      userId: 42,
    });
    req.flush(1);
  });

  it('should update a rule with a PUT carrying its id and no user id', () => {
    // arrange
    let id = 0;

    // act
    service
      .updateRule({ id: 9, keywords: ['shell'], categoryId: 6, matchType: 'AND', priority: 2 })
      .subscribe((value) => (id = value));

    // assert & verify
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      id: 9,
      keywords: ['shell'],
      categoryId: 6,
      matchType: 'AND',
      priority: 2,
    });
    req.flush(9);
    expect(id).toBe(9);
  });

  it('should delete a rule by id', () => {
    // act
    service.deleteRule(9).subscribe();

    // assert & verify
    const req = httpMock.expectOne(`${apiUrl}/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
