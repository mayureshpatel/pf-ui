import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { DescriptionLinkResult } from '@models/merchant.model';
import { MerchantApiService } from './merchant-api.service';

/**
 * PF-883: the Merchants page shows its own toast for every failed call, so the generic
 * "Something went wrong" toast must stay off, or a failed batch of 3 links shows 3 of them.
 */
describe('MerchantApiService', () => {
  let service: MerchantApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      ],
    });
    service = TestBed.inject(MerchantApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const RESULT: DescriptionLinkResult = {
    merchantId: 4,
    linkedCount: 1,
    movedCount: 0,
    transactionsFilled: 2,
    linkChanges: [],
    filledTransactionIds: [7, 8],
  };

  it('should post the descriptions to check to the merchant', () => {
    // act
    service.checkDescriptionLinks(4, ['KROGER #1', 'KROGER FUEL CTR #2']).subscribe();

    // assert & verify
    const req = http.expectOne((r) => r.url.endsWith('/merchants/4/description-links/check'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ descriptions: ['KROGER #1', 'KROGER FUEL CTR #2'] });
    req.flush({ merchantId: 4, warnings: [] });
  });

  it('should send a link result back as is to undo it', () => {
    // act
    service.undoDescriptionLinks(RESULT).subscribe();

    // assert & verify
    const req = http.expectOne((r) => r.url.endsWith('/merchants/4/description-links/undo'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(RESULT);
    req.flush({});
  });

  const cases: [string, () => void][] = [
    ['getMerchants', () => service.getMerchants('a', { page: 0, size: 20 }).subscribe()],
    ['createMerchant', () => service.createMerchant({ name: 'A', userId: 1 }).subscribe()],
    ['updateMerchant', () => service.updateMerchant({ id: 1, name: 'A', userId: 1 }).subscribe()],
    ['deleteMerchant', () => service.deleteMerchant(1).subscribe()],
    ['getDescriptionLinks', () => service.getDescriptionLinks(1).subscribe()],
    ['addDescriptionLink', () => service.addDescriptionLink(1, 'AMZN').subscribe()],
    ['addDescriptionLinks', () => service.addDescriptionLinks(1, ['AMZN', 'COSTCO']).subscribe()],
    ['deleteDescriptionLink', () => service.deleteDescriptionLink(1, 10).subscribe()],
    ['checkDescriptionLinks', () => service.checkDescriptionLinks(4, ['KROGER #1']).subscribe()],
    ['undoDescriptionLinks', () => service.undoDescriptionLinks(RESULT).subscribe()],
  ];

  it.each(cases)('should opt %s out of the generic error toast', (_name, call) => {
    // act
    call();

    // assert & verify
    const req = http.expectOne(() => true);
    expect(req.request.context.get(SKIP_GENERIC_ERROR_TOAST)).toBe(true);
    req.flush(null);
  });
});
