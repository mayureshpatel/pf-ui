import {HttpContextToken, HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, Observable, throwError} from 'rxjs';
import {AuthService} from './auth.service';
import {ToastService} from '../services/toast.service';

/**
 * Set on a request's `HttpContext` to opt out of the interceptor's generic error toast --
 * for call sites that already show their own specific, bespoke error message (a toast, an
 * inline form error, etc.) and would otherwise double up with the generic default.
 *
 * Usage: `this.http.get(url, {context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true)})`.
 */
export const SKIP_GENERIC_ERROR_TOAST = new HttpContextToken<boolean>((): boolean => false);

/**
 * Interceptor for handling global HTTP error responses.
 * @param req the outgoing request
 * @param next the next interceptor in the chain
 * @returns an observable that emits the error response or rethrows the error
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService: AuthService = inject(AuthService);
  const toastService: ToastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse): Observable<never> => {
      // Handle 401 Unauthorized globally
      if (error.status === 401 && !req.url.includes('/auth/')) {
        authService.handleUnauthorized();
      } else if (!req.context.get(SKIP_GENERIC_ERROR_TOAST)) {
        // Safety-net toast for any failure a call site hasn't opted out of and doesn't
        // otherwise have specific handling for -- see SKIP_GENERIC_ERROR_TOAST above.
        toastService.error('Something went wrong', 'Please try again.');
      }
      return throwError((): HttpErrorResponse => error);
    })
  );
};
