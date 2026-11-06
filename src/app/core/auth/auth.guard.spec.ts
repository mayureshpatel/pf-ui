import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAppInitializer } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { guestGuard, requireAuth } from './auth.guard';
import { restoreSessionOnStartup } from './auth.initializer';

describe('auth guards after session restore', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  function setup(restored: boolean) {
    const authenticated = signal(false);
    const restoreSession = vi.fn(async () => {
      await Promise.resolve();
      authenticated.set(restored);
      return restored;
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAuthenticated: authenticated, restoreSession } },
        provideAppInitializer(restoreSessionOnStartup),
      ],
    });
    return { restoreSession };
  }

  it('runs the restore once from the app initializer', async () => {
    const { restoreSession } = setup(true);

    await TestBed.inject(Router).navigateByUrl('/');

    expect(restoreSession).toHaveBeenCalledOnce();
  });

  it('lets requireAuth through once the restore signed the user in', async () => {
    setup(true);
    await TestBed.inject(Router).navigateByUrl('/');

    expect(TestBed.runInInjectionContext(() => requireAuth(route, state))).toBe(true);
  });

  it('sends requireAuth to /login when the restore found no session', async () => {
    setup(false);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');

    const result = TestBed.runInInjectionContext(() => requireAuth(route, state));

    expect(router.serializeUrl(result as ReturnType<Router['createUrlTree']>)).toBe('/login');
  });

  it('sends guestGuard to /dashboard when a session was restored, else lets guests in', async () => {
    setup(true);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    const redirect = TestBed.runInInjectionContext(() => guestGuard(route, state));
    expect(router.serializeUrl(redirect as ReturnType<Router['createUrlTree']>)).toBe('/dashboard');
  });

  it('lets guestGuard through when no session was restored', async () => {
    setup(false);
    await TestBed.inject(Router).navigateByUrl('/');

    expect(TestBed.runInInjectionContext(() => guestGuard(route, state))).toBe(true);
  });
});
