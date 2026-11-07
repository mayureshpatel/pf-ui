import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@env';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { AuthService } from '@core/auth/auth.service';
import { RuleApplicationApiService } from './rule-application-api.service';

describe('RuleApplicationApiService', () => {
  let service: RuleApplicationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => ({ id: 42 }) } },
      ],
    });
    service = TestBed.inject(RuleApplicationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should send the apply result back to the undo endpoint and return what was restored (PF-928)', () => {
    // arrange
    const applied = {
      ruleId: 7,
      categoryId: 5,
      changes: [{ transactionId: 1, previousCategoryId: null }],
      skippedTransactionIds: [],
    };
    const reply = {
      restoredCount: 1,
      skippedTransactionIds: [],
      categoryRuleDeleted: true,
      merchantRuleDeleted: false,
    };
    let result: unknown;

    // act
    service.undo({ category: applied }).subscribe((r) => (result = r));

    // assert & verify
    const req = httpMock.expectOne(`${environment.apiUrl}/rule-applications/undo`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ category: applied });
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(reply);
    expect(result).toEqual(reply);
  });

  it("should create both kinds of rule in one call, with the user's id on the category rule (PF-934)", () => {
    // arrange
    const reply = {
      category: { ruleId: 1, categoryId: 2, changes: [], skippedTransactionIds: [] },
      merchant: { ruleId: 3, merchantId: 4, changes: [] },
    };
    let result: unknown;

    // act
    service
      .createBothAndApply({
        category: {
          rule: { keywords: ['taco'], categoryId: 2, priority: 0 } as never,
          transactionIds: [1],
        },
        merchant: { rule: { merchantId: 4, keywords: ['taco'] }, transactionIds: [1, 2] },
      })
      .subscribe((r) => (result = r));

    // assert & verify
    const req = httpMock.expectOne(`${environment.apiUrl}/rule-applications/create-both-and-apply`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      category: {
        rule: { keywords: ['taco'], categoryId: 2, priority: 0, userId: 42 },
        transactionIds: [1],
      },
      merchant: { rule: { merchantId: 4, keywords: ['taco'] }, transactionIds: [1, 2] },
    });
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(reply);
    expect(result).toEqual(reply);
  });
});
