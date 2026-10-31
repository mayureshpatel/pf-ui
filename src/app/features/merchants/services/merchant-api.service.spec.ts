import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
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

  const cases: [string, () => void][] = [
    ['getMerchants', () => service.getMerchants('a', { page: 0, size: 20 }).subscribe()],
    ['createMerchant', () => service.createMerchant({ name: 'A', userId: 1 }).subscribe()],
    ['updateMerchant', () => service.updateMerchant({ id: 1, name: 'A', userId: 1 }).subscribe()],
    ['deleteMerchant', () => service.deleteMerchant(1).subscribe()],
    ['getDescriptionLinks', () => service.getDescriptionLinks(1).subscribe()],
    ['addDescriptionLink', () => service.addDescriptionLink(1, 'AMZN').subscribe()],
    ['deleteDescriptionLink', () => service.deleteDescriptionLink(1, 10).subscribe()],
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
