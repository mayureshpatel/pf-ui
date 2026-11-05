import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@env';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { RuleDraft, RuleMatchPreview } from '@models/category-rule.model';
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

  // PF-890: the page shows its own message for a refused create, so the generic toast stays off
  it('should keep the generic error toast off for a create', () => {
    // act
    service.createRule({ keywords: ['a'], categoryId: 5, priority: 0 } as never).subscribe();

    // assert & verify
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(1);
  });

  describe('previewMatches', () => {
    const draft: RuleDraft = {
      ruleId: null,
      keywords: ['netflix', 'hulu'],
      matchType: 'OR',
      priority: 3,
      minAmount: 5,
      maxAmount: null,
    };
    const preview: RuleMatchPreview = {
      totalMatches: 1,
      willCategorizeCount: 1,
      losesToOtherRuleCount: 0,
      alreadyCategorizedCount: 0,
      truncated: false,
      rows: [
        {
          transactionId: 7,
          date: '2026-10-01T00:00:00Z',
          description: 'NETFLIX.COM',
          amount: 15.49,
          accountName: 'Checking',
          currentCategory: null,
          verdict: 'WILL_CATEGORIZE',
          otherRules: [],
        },
      ],
    };

    it('previewMatches posts the draft to category-rules/match-preview and returns the parsed preview', () => {
      // arrange
      let result: RuleMatchPreview | undefined;

      // act
      service.previewMatches(draft).subscribe((value) => (result = value));

      // assert & verify
      const req = httpMock.expectOne(`${apiUrl}/match-preview`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        ruleId: null,
        keywords: ['netflix', 'hulu'],
        matchType: 'OR',
        priority: 3,
        minAmount: 5,
        maxAmount: null,
      });
      expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
      req.flush(preview);
      expect(result).toEqual(preview);
    });

    it('previewMatches sends ruleId null for a new draft', () => {
      // act
      service.previewMatches(draft).subscribe();

      // assert & verify
      const req = httpMock.expectOne(`${apiUrl}/match-preview`);
      expect(req.request.body.ruleId).toBeNull();
      req.flush(preview);
    });

    it("previewMatches sends the edited rule's id", () => {
      // act
      service.previewMatches({ ...draft, ruleId: 12 }).subscribe();

      // assert & verify
      const req = httpMock.expectOne(`${apiUrl}/match-preview`);
      expect(req.request.body.ruleId).toBe(12);
      req.flush(preview);
    });
  });
});
