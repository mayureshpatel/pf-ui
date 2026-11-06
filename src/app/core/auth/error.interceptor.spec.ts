import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpContext,
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
} from '@angular/common/http';
import { throwError, of } from 'rxjs';
import { errorInterceptor, SKIP_GENERIC_ERROR_TOAST } from './error.interceptor';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { environment } from '@env';
import { AuthService } from './auth.service';
import { jwtInterceptor } from './jwt.interceptor';
import { ToastService } from '../services/toast.service';

describe('errorInterceptor', () => {
  let handleUnauthorized: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;
  let renewSession: ReturnType<typeof vi.fn>;
  let getToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    renewSession = vi.fn().mockResolvedValue(false);
    getToken = vi.fn().mockReturnValue(null);
    handleUnauthorized = vi.fn();
    toastError = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { handleUnauthorized, renewSession, getToken } },
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
  });

  function runWith(status: number, url = '/api/v1/accounts', context = new HttpContext()) {
    const req = new HttpRequest('GET', url, { context });
    const error = new HttpErrorResponse({ status });
    const next: HttpHandlerFn = () => throwError(() => error);

    return new Promise<void>((resolve) => {
      TestBed.runInInjectionContext(() => {
        errorInterceptor(req, next).subscribe({
          error: () => resolve(),
        });
      });
    });
  }

  it('should call handleUnauthorized on a 401 outside /auth/, without a generic toast', async () => {
    // Arrange & Act
    await runWith(401, '/api/v1/accounts');

    // Assert
    expect(handleUnauthorized).toHaveBeenCalledOnce();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('should show a generic toast for a non-401 failure with no opt-out', async () => {
    // Arrange & Act
    await runWith(500, '/api/v1/accounts');

    // Assert
    expect(handleUnauthorized).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledOnce();
  });

  it('should not show a generic toast when the request opts out via SKIP_GENERIC_ERROR_TOAST', async () => {
    // Arrange
    const context = new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true);

    // Act
    await runWith(500, '/api/v1/accounts', context);

    // Assert
    expect(toastError).not.toHaveBeenCalled();
  });

  it('should not treat a 401 on an /auth/ route as an unauthorized session', async () => {
    // Arrange & Act
    await runWith(401, '/api/v1/auth/authenticate');

    // Assert
    expect(handleUnauthorized).not.toHaveBeenCalled();
    // falls through to the generic toast, since it's not opted out and not the handled-401 case
    expect(toastError).toHaveBeenCalledOnce();
  });

  it('should pass through a successful response unchanged', async () => {
    // Arrange
    const req = new HttpRequest('GET', '/api/v1/accounts', { context: new HttpContext() });
    const next: HttpHandlerFn = () => of({ type: 4 } as unknown as HttpEvent<unknown>);

    // Act & Assert
    await new Promise<void>((resolve) => {
      TestBed.runInInjectionContext(() => {
        errorInterceptor(req, next).subscribe({
          next: (event) => {
            expect(event).toEqual({ type: 4 });
            resolve();
          },
        });
      });
    });
    expect(handleUnauthorized).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});

function makeToken(expOffsetSeconds: number, tag = 'a'): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const payload = btoa(JSON.stringify({ sub: tag, userId: 7, email: 'j@x.io', iat: 0, exp }));
  return `h.${payload}.s`;
}

describe('errorInterceptor session renewal (real AuthService)', () => {
  const api = environment.apiUrl;
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.fn>;
  let toast: {
    success: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    navigate = vi.fn();
    toast = { success: vi.fn(), warn: vi.fn(), error: vi.fn() };
    // Real Web Locks would defer the refresh call by a task; these specs run without it.
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate, url: '/transactions?page=2' } },
        { provide: ToastService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    const restored = auth.restoreSession();
    http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken(900, 'old') });
    await restored;
  });

  afterEach(() => {
    http.verify();
    delete (navigator as unknown as Record<string, unknown>)['locks'];
  });

  const flush = () => new Promise<void>((r) => setTimeout(r));

  it('renews on a 401 and replays the original request once with the new token', async () => {
    const results: unknown[] = [];
    client.get('/api/v1/accounts').subscribe((r) => results.push(r));

    http.expectOne('/api/v1/accounts').flush({}, { status: 401, statusText: 'Unauthorized' });
    await flush();
    const fresh = makeToken(900, 'new');
    http.expectOne(`${api}/auth/refresh`).flush({ token: fresh });
    await flush();
    const replay = http.expectOne('/api/v1/accounts');
    expect(replay.request.headers.get('Authorization')).toBe(`Bearer ${fresh}`);
    replay.flush({ ok: true });

    expect(results).toEqual([{ ok: true }]);
    expect(toast.warn).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ends the session when the replayed request 401s again, without looping', async () => {
    let failed = false;
    client.get('/api/v1/accounts').subscribe({ error: () => (failed = true) });

    http.expectOne('/api/v1/accounts').flush({}, { status: 401, statusText: 'Unauthorized' });
    await flush();
    http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken(900, 'new') });
    await flush();
    http.expectOne('/api/v1/accounts').flush({}, { status: 401, statusText: 'Unauthorized' });
    await flush();

    http.expectNone(`${api}/auth/refresh`);
    expect(failed).toBe(true);
    expect(toast.warn).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/transactions?page=2' },
    });
  });

  it('shares one renewal across parallel 401s and replays each request once', async () => {
    const done: string[] = [];
    for (const path of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) {
      client.get(path).subscribe(() => done.push(path));
    }
    for (const path of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) {
      http.expectOne(path).flush({}, { status: 401, statusText: 'Unauthorized' });
    }
    await flush();
    http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken(900, 'new') });
    await flush();
    for (const path of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) {
      http.expectOne(path).flush({});
    }

    expect(done.sort()).toEqual(['/api/v1/a', '/api/v1/b', '/api/v1/c']);
  });

  it('gives one toast and one redirect when a shared renewal fails', async () => {
    let errors = 0;
    for (const path of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) {
      client.get(path).subscribe({ error: () => errors++ });
    }
    for (const path of ['/api/v1/a', '/api/v1/b', '/api/v1/c']) {
      http.expectOne(path).flush({}, { status: 401, statusText: 'Unauthorized' });
    }
    await flush();
    http
      .expectOne(`${api}/auth/refresh`)
      .flush({ detail: 'revoked' }, { status: 401, statusText: 'Unauthorized' });
    await flush();

    expect(errors).toBe(3);
    expect(toast.warn).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/transactions?page=2' },
    });
  });

  it('never renews for a 401 on an /auth/ URL', async () => {
    client.post(`${api}/auth/other`, {}).subscribe({ error: () => undefined });

    http.expectOne(`${api}/auth/other`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await flush();

    http.expectNone(`${api}/auth/refresh`);
    expect(toast.warn).not.toHaveBeenCalled();
  });

  it('keeps the generic toast for a non-401 failure and does not renew', async () => {
    client.get('/api/v1/accounts').subscribe({ error: () => undefined });

    http.expectOne('/api/v1/accounts').flush({}, { status: 500, statusText: 'Boom' });
    await flush();

    http.expectNone(`${api}/auth/refresh`);
    expect(toast.error).toHaveBeenCalledOnce();
  });
});
