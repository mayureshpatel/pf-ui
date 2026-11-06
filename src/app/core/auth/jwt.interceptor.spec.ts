import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { AuthService } from './auth.service';
import { jwtInterceptor } from './jwt.interceptor';
import { ToastService } from '../services/toast.service';

function makeToken(expOffsetSeconds: number, tag = 'a'): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const payload = btoa(JSON.stringify({ sub: tag, userId: 7, email: 'j@x.io', iat: 0, exp }));
  return `h.${payload}.s`;
}

describe('jwtInterceptor', () => {
  const api = environment.apiUrl;
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;

  async function signIn(token: string): Promise<void> {
    const restored = auth.restoreSession();
    http.expectOne(`${api}/auth/refresh`).flush({ token });
    await restored;
  }

  const flush = () => new Promise<void>((r) => setTimeout(r));

  beforeEach(() => {
    // Real Web Locks would defer the refresh call by a task; these specs run without it.
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate: vi.fn(), url: '/' } },
        { provide: ToastService, useValue: { success: vi.fn(), warn: vi.fn(), info: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    http.verify();
    delete (navigator as unknown as Record<string, unknown>)['locks'];
  });

  it('attaches a healthy token without renewing', async () => {
    const token = makeToken(900);
    await signIn(token);

    client.get('/api/v1/accounts').subscribe();

    const req = http.expectOne('/api/v1/accounts');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush({});
  });

  it('renews first when the token expires within 30 seconds, then sends with the new token', async () => {
    await signIn(makeToken(10, 'old'));

    client.get('/api/v1/accounts').subscribe();
    http.expectNone('/api/v1/accounts');
    const fresh = makeToken(900, 'new');
    http.expectOne(`${api}/auth/refresh`).flush({ token: fresh });
    await flush();

    const req = http.expectOne('/api/v1/accounts');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${fresh}`);
    req.flush({});
  });

  it('shares one renewal between simultaneous near-expiry requests', async () => {
    await signIn(makeToken(5, 'old'));

    client.get('/api/v1/a').subscribe();
    client.get('/api/v1/b').subscribe();
    http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken(900, 'new') });
    await flush();

    http.expectOne('/api/v1/a').flush({});
    http.expectOne('/api/v1/b').flush({});
  });

  it('sends the request as is when the pre-flight renewal fails', async () => {
    const old = makeToken(10, 'old');
    await signIn(old);

    client.get('/api/v1/accounts').subscribe();
    http.expectOne(`${api}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await flush();

    const req = http.expectOne('/api/v1/accounts');
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${old}`);
    req.flush({});
  });

  it('leaves /auth/ URLs untouched, even near expiry', async () => {
    await signIn(makeToken(5));

    client.post(`${api}/auth/logout`, null).subscribe();

    const req = http.expectOne(`${api}/auth/logout`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('sends no Authorization header and does not renew when signed out', () => {
    client.get('/api/v1/accounts').subscribe();

    const req = http.expectOne('/api/v1/accounts');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
