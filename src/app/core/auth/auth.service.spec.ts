import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { AuthService } from './auth.service';
import { ToastService } from '../services/toast.service';

function makeToken(expOffsetSeconds = 900, sub = 'jdoe'): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const payload = btoa(JSON.stringify({ sub, userId: 7, email: 'j@x.io', iat: 0, exp }));
  return `h.${payload}.s`;
}

describe('AuthService', () => {
  const api = environment.apiUrl;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;
  let toast: {
    success: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
        { provide: ToastService, useValue: toast },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    navigate = vi.fn();
    toast = { success: vi.fn(), info: vi.fn(), warn: vi.fn() };
    // Real Web Locks would defer the refresh call by a task; these specs run without it.
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  });

  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>)['locks'];
    http.verify();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes the legacy token keys from both storages at startup', () => {
    localStorage.setItem('pf_auth_token', 'old');
    localStorage.setItem('pf_storage_type', 'local');
    sessionStorage.setItem('pf_auth_token', 'old');
    sessionStorage.setItem('pf_storage_type', 'session');

    setup();

    expect(localStorage.getItem('pf_auth_token')).toBeNull();
    expect(localStorage.getItem('pf_storage_type')).toBeNull();
    expect(sessionStorage.getItem('pf_auth_token')).toBeNull();
    expect(sessionStorage.getItem('pf_storage_type')).toBeNull();
  });

  it('starts signed out even if a stale token was in storage', () => {
    localStorage.setItem('pf_auth_token', makeToken());
    const service = setup();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.getToken()).toBeNull();
  });

  describe('login', () => {
    it('sends rememberMe with credentials enabled and keeps the token in memory only', () => {
      const service = setup();
      const token = makeToken();

      service.login({ username: 'jdoe', password: 'pw' }, true).subscribe();
      const req = http.expectOne(`${api}/auth/authenticate`);
      expect(req.request.body).toEqual({ username: 'jdoe', password: 'pw', rememberMe: true });
      expect(req.request.withCredentials).toBe(true);
      req.flush({ token });

      expect(service.getToken()).toBe(token);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.username()).toBe('jdoe');
      expect(service.tokenExpiresAt()).toBeGreaterThan(Date.now());
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('sends rememberMe false when not requested', () => {
      const service = setup();

      service.login({ username: 'jdoe', password: 'pw' }, false).subscribe();
      const req = http.expectOne(`${api}/auth/authenticate`);

      expect(req.request.body.rememberMe).toBe(false);
      req.flush({ token: makeToken() });
    });

    it('maps a 401 to an invalid-credentials error and stays signed out', () => {
      const service = setup();
      let message = '';

      service.login({ username: 'jdoe', password: 'bad' }, false).subscribe({
        error: (e: Error) => (message = e.message),
      });
      http.expectOne(`${api}/auth/authenticate`).flush({}, { status: 401, statusText: 'x' });

      expect(message).toBe('Invalid username or password');
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('register', () => {
    it('signs in session-only: token in memory, credentials enabled, no storage writes', () => {
      const service = setup();
      const token = makeToken();

      service
        .register({ username: 'jdoe', email: 'j@x.io', password: 'pw', website: '' })
        .subscribe();
      const req = http.expectOne(`${api}/auth/register`);
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body.rememberMe).toBeUndefined();
      req.flush({ token });

      expect(service.getToken()).toBe(token);
      expect(service.isAuthenticated()).toBe(true);
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });
  });

  describe('restoreSession', () => {
    it('refreshes with credentials and no body, then marks the user authenticated', async () => {
      const service = setup();
      const token = makeToken();

      const result = service.restoreSession();
      const req = http.expectOne(`${api}/auth/refresh`);
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);
      expect(req.request.body).toBeNull();
      req.flush({ token });

      await expect(result).resolves.toBe(true);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.getToken()).toBe(token);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('stays signed out quietly on a 401', async () => {
      const service = setup();

      const result = service.restoreSession();
      http.expectOne(`${api}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

      await expect(result).resolves.toBe(false);
      expect(service.isAuthenticated()).toBe(false);
      expect(toast.warn).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('stays signed out on a network error', async () => {
      const service = setup();

      const result = service.restoreSession();
      http.expectOne(`${api}/auth/refresh`).error(new ProgressEvent('error'));

      await expect(result).resolves.toBe(false);
      expect(service.isAuthenticated()).toBe(false);
    });

    it('does not treat an already expired token as a session', async () => {
      const service = setup();

      const result = service.restoreSession();
      http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken(-60) });

      await expect(result).resolves.toBe(false);
      expect(service.getToken()).toBeNull();
    });
  });

  describe('logout', () => {
    async function signIn(service: AuthService): Promise<void> {
      const result = service.restoreSession();
      http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken() });
      await result;
    }

    it('calls the logout endpoint with credentials, clears state and goes to /login', async () => {
      const service = setup();
      await signIn(service);

      service.logout();
      const req = http.expectOne(`${api}/auth/logout`);
      expect(req.request.withCredentials).toBe(true);
      req.flush(null, { status: 204, statusText: 'No Content' });

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getToken()).toBeNull();
      expect(service.user()).toBeNull();
      expect(toast.info).toHaveBeenCalledWith('Logged out');
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('still clears local state and navigates when the call fails', async () => {
      const service = setup();
      await signIn(service);

      service.logout();
      http.expectOne(`${api}/auth/logout`).flush({}, { status: 500, statusText: 'Boom' });

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getToken()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  it('handleUnauthorized clears the session and redirects to /login', async () => {
    const service = setup();
    const result = service.restoreSession();
    http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken() });
    await result;

    service.handleUnauthorized();

    expect(service.isAuthenticated()).toBe(false);
    expect(toast.warn).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  describe('renewSession', () => {
    async function signIn(service: AuthService, token = makeToken()): Promise<void> {
      const result = service.restoreSession();
      http.expectOne(`${api}/auth/refresh`).flush({ token });
      await result;
    }

    it('stores the new token and resolves true', async () => {
      const service = setup();
      await signIn(service, makeToken(60, 'old'));
      const fresh = makeToken(900, 'new');

      const result = service.renewSession();
      const req = http.expectOne(`${api}/auth/refresh`);
      expect(req.request.withCredentials).toBe(true);
      req.flush({ token: fresh });

      expect(await result).toBe(true);
      expect(service.getToken()).toBe(fresh);
    });

    it('shares one HTTP call between concurrent callers, then allows a later renewal', async () => {
      const service = setup();
      await signIn(service);

      const all = Promise.all([
        service.renewSession(),
        service.renewSession(),
        service.renewSession(),
      ]);
      http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken(900, 'n1') });
      expect(await all).toEqual([true, true, true]);

      const later = service.renewSession();
      http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken(900, 'n2') });
      expect(await later).toBe(true);
    });

    it('resolves false (never rejects) when the refresh fails', async () => {
      const service = setup();
      await signIn(service);

      const result = service.renewSession();
      http.expectOne(`${api}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(await result).toBe(false);
    });

    describe('Web Locks', () => {
      afterEach(() => {
        // Removes the instance override so the browser's own navigator.locks shows through again.
        delete (navigator as unknown as Record<string, unknown>)['locks'];
      });

      it('runs the refresh inside the lock when navigator.locks exists', async () => {
        const events: string[] = [];
        Object.defineProperty(navigator, 'locks', {
          configurable: true,
          value: {
            request: async (name: string, task: () => Promise<unknown>) => {
              events.push(`acquire:${name}`);
              const out = await task();
              events.push('release');
              return out;
            },
          },
        });
        const service = setup();

        const result = service.renewSession();
        await vi.waitFor(() => http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken() }));

        expect(await result).toBe(true);
        expect(events[0]).toBe('acquire:pf-auth-refresh');
        expect(events).toContain('release');
      });

      it('falls back to a direct call when navigator.locks is unavailable', async () => {
        Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
        const service = setup();

        const result = service.renewSession();
        http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken() });

        expect(await result).toBe(true);
      });
    });
  });

  describe('handleUnauthorized', () => {
    it('toasts and redirects only once for repeated calls', async () => {
      const service = setup();
      const restored = service.restoreSession();
      http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken() });
      await restored;

      service.handleUnauthorized();
      service.handleUnauthorized();

      expect(toast.warn).toHaveBeenCalledOnce();
      expect(navigate).toHaveBeenCalledOnce();
    });

    it('carries the current in-app URL as returnUrl', () => {
      const service = setup();
      const router = TestBed.inject(Router) as unknown as { url: string };

      router.url = '/accounts/5?tab=x';
      service.handleUnauthorized();
      expect(navigate).toHaveBeenLastCalledWith(['/login'], {
        queryParams: { returnUrl: '/accounts/5?tab=x' },
      });
    });

    it('omits returnUrl when already on /login', () => {
      const service = setup();
      (TestBed.inject(Router) as unknown as { url: string }).url = '/login';

      service.handleUnauthorized();

      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('can end a later session again after a new sign-in', async () => {
      const service = setup();
      service.handleUnauthorized();
      const restored = service.restoreSession();
      http.expectOne(`${api}/auth/refresh`).flush({ token: makeToken() });
      await restored;

      service.handleUnauthorized();

      expect(toast.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('cross-tab (BroadcastChannel)', () => {
    let otherTab: BroadcastChannel;
    let received: unknown[];

    beforeEach(() => {
      received = [];
      otherTab = new BroadcastChannel('pf-auth');
      otherTab.onmessage = (e: MessageEvent): void => {
        received.push(e.data);
      };
    });

    afterEach(() => otherTab.close());

    async function signIn(service: AuthService, token: string): Promise<void> {
      const result = service.restoreSession();
      http.expectOne(`${api}/auth/refresh`).flush({ token });
      await result;
    }

    it('tells other tabs about a logout', async () => {
      const service = setup();
      await signIn(service, makeToken());

      service.logout();
      http.expectOne(`${api}/auth/logout`).flush(null);

      await vi.waitFor(() => expect(received).toContainEqual({ type: 'logout' }));
    });

    it('signs this tab out silently, without a server call or second toast, on another tab logout', async () => {
      const service = setup();
      await signIn(service, makeToken());

      otherTab.postMessage({ type: 'logout' });

      await vi.waitFor(() => expect(service.isAuthenticated()).toBe(false));
      expect(navigate).toHaveBeenCalledWith(['/login']);
      expect(toast.info).not.toHaveBeenCalled();
      expect(toast.warn).not.toHaveBeenCalled();
      http.expectNone(`${api}/auth/logout`);
    });

    it('broadcasts a renewed token to other tabs', async () => {
      const service = setup();
      await signIn(service, makeToken(60));
      const fresh = makeToken(900, 'new');

      const result = service.renewSession();
      http.expectOne(`${api}/auth/refresh`).flush({ token: fresh });
      await result;

      await vi.waitFor(() => expect(received).toContainEqual({ type: 'token', token: fresh }));
    });

    it('adopts a broadcast token that expires later than its own', async () => {
      const service = setup();
      await signIn(service, makeToken(60));
      const newer = makeToken(900, 'newer');

      otherTab.postMessage({ type: 'token', token: newer });

      await vi.waitFor(() => expect(service.getToken()).toBe(newer));
    });

    it('ignores a broadcast token that is not newer than its own', async () => {
      const service = setup();
      const own = makeToken(900);
      await signIn(service, own);

      otherTab.postMessage({ type: 'token', token: makeToken(60, 'older') });
      otherTab.postMessage({ type: 'token', token: 'garbage' });
      await new Promise((r) => setTimeout(r, 50));

      expect(service.getToken()).toBe(own);
    });

    it('does not sign in a signed-out tab from a broadcast token', async () => {
      const service = setup();

      otherTab.postMessage({ type: 'token', token: makeToken(900) });
      await new Promise((r) => setTimeout(r, 50));

      expect(service.isAuthenticated()).toBe(false);
    });
  });
});
