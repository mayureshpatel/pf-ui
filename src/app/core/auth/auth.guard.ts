import {inject} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {AuthService} from './auth.service';

/**
 * Defines guard for authenticated-user only routes.
 *
 * This guard checks if the user is authenticated before allowing access to protected routes.
 * If the user is not authenticated, they are redirected to the login page.
 * @param route
 * @param state
 * @returns true if the user is authenticated, otherwise redirects to the login page.
 */
export const requireAuth: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): true | UrlTree => {
  const authService: AuthService = inject(AuthService);
  const router: Router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Defines guard for guest-only routes.
 *
 * This guard redirects users who are not authenticated to the
 * @returns true if the user is not authenticated, otherwise redirects to the dashboard.
 */
export const guestGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): true | UrlTree => {
  const authService: AuthService = inject(AuthService);
  const router: Router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
