import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/auth/auth.service';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { TagApiService } from './tag-api.service';

/**
 * PF-890: the Settings > Tags page shows its own message for a refused create, update or load, so it
 * asks for the generic toast to stay off. Other pages that load tags keep the generic toast.
 */
describe('TagApiService', () => {
  let service: TagApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      ],
    });
    service = TestBed.inject(TagApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const skips = (): boolean => {
    const req = http.expectOne(() => true);
    const skipped = req.request.context.get(SKIP_GENERIC_ERROR_TOAST);
    req.flush(null);
    return skipped;
  };

  it('should keep the generic toast off for a create and an update', () => {
    // act & assert
    service.createTag({ name: 'A', color: '#3b82f6', userId: 1 } as never).subscribe();
    expect(skips()).toBe(true);
    service.updateTag({ id: 1, name: 'A', color: '#3b82f6' } as never).subscribe();
    expect(skips()).toBe(true);
  });

  it('should keep the generic toast off for a load only when asked', () => {
    // act & assert
    service.getTags().subscribe();
    expect(skips()).toBe(false);
    service.getTags(true).subscribe();
    expect(skips()).toBe(true);
  });
});
