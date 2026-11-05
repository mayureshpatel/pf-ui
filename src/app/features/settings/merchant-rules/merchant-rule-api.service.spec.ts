import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '@env';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import {
  MerchantRuleChangePreview,
  MerchantRuleDraft,
  MerchantRuleMatchPreview,
} from '@models/merchant-rule.model';
import { MerchantRuleApiService } from './merchant-rule-api.service';

describe('MerchantRuleApiService', () => {
  let service: MerchantRuleApiService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/merchant-rules`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MerchantRuleApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MerchantRuleApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should list rules without the generic error toast', () => {
    // act
    service.getRules().subscribe();

    // assert & verify
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush([]);
  });

  it('should create a rule exactly as given, with no user id, and return its id', () => {
    // arrange
    let id = 0;

    // act
    service
      .createRule({ keywords: ['kroger'], merchantId: 5, priority: 2 })
      .subscribe((value) => (id = value));

    // assert & verify
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ keywords: ['kroger'], merchantId: 5, priority: 2 });
    expect(req.request.body.userId).toBeUndefined();
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(31);
    expect(id).toBe(31);
  });

  it('should update a rule with a PUT carrying its id', () => {
    // arrange
    let changed = 0;

    // act
    service
      .updateRule({ id: 9, keywords: ['kroger'], merchantId: 5, priority: 2 })
      .subscribe((value) => (changed = value));

    // assert & verify
    const req = httpMock.expectOne(apiUrl);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ id: 9, keywords: ['kroger'], merchantId: 5, priority: 2 });
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(1);
    expect(changed).toBe(1);
  });

  it('should delete a rule by id', () => {
    // act
    service.deleteRule(9).subscribe();

    // assert & verify
    const req = httpMock.expectOne(`${apiUrl}/9`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(null);
  });

  it('should list the changes applying the rules would make', () => {
    // arrange
    let result: MerchantRuleChangePreview[] = [];
    const changes = [{ transactionId: 1, description: 'KROGER' }] as MerchantRuleChangePreview[];

    // act
    service.previewApply().subscribe((value) => (result = value));

    // assert & verify
    const req = httpMock.expectOne(`${apiUrl}/preview`);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(changes);
    expect(result).toEqual(changes);
  });

  it('should apply the rules and return how many transactions changed', () => {
    // arrange
    let changed = -1;

    // act
    service.applyRules().subscribe((value) => (changed = value));

    // assert & verify
    const req = httpMock.expectOne(`${apiUrl}/apply`);
    expect(req.request.method).toBe('POST');
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(12);
    expect(changed).toBe(12);
  });

  describe('previewMatches', () => {
    const draft: MerchantRuleDraft = {
      ruleId: null,
      keywords: ['kroger', '431'],
      matchType: 'AND',
      priority: 3,
      minAmount: 5,
      maxAmount: null,
      merchantId: 6,
    };
    const preview = {
      targetMerchantName: 'Kroger',
      totalMatches: 0,
      willAssignCount: 0,
      losesToOtherRuleCount: 0,
      alreadyHasMerchantCount: 0,
      linkedCount: 0,
      truncated: false,
      rows: [],
    } as MerchantRuleMatchPreview;

    it('should post the draft to merchant-rules/match-preview and return the preview', () => {
      // arrange
      let result: MerchantRuleMatchPreview | undefined;

      // act
      service.previewMatches(draft).subscribe((value) => (result = value));

      // assert & verify
      const req = httpMock.expectOne(`${apiUrl}/match-preview`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        ruleId: null,
        keywords: ['kroger', '431'],
        matchType: 'AND',
        priority: 3,
        minAmount: 5,
        maxAmount: null,
        merchantId: 6,
      });
      expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
      req.flush(preview);
      expect(result).toEqual(preview);
    });

    it("should send the edited rule's id and a null merchant until one is chosen", () => {
      // act
      service.previewMatches({ ...draft, ruleId: 12, merchantId: null }).subscribe();

      // assert & verify
      const req = httpMock.expectOne(`${apiUrl}/match-preview`);
      expect(req.request.body.ruleId).toBe(12);
      expect(req.request.body.merchantId).toBeNull();
      req.flush(preview);
    });
  });
});
