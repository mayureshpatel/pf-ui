import {
  HttpContext,
  HttpContextToken,
  HttpEvent,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ToastService } from '../services/toast.service';

/**
 * Set on a request's `HttpContext` to opt out of the interceptor's generic error toast --
 * for call sites that already show their own specific, bespoke error message (a toast, an
 * inline form error, etc.) and would otherwise double up with the generic default.
 *
 * Usage: `this.http.get(url, {context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true)})`.
 */
export const SKIP_GENERIC_ERROR_TOAST = new HttpContextToken<boolean>((): boolean => false);

/** Marks a request that is already a post-renewal replay, so a second 401 never loops. */
const RENEWAL_REPLAY = new HttpContextToken<boolean>((): boolean => false);

/**
 * Interceptor for handling global HTTP error responses.
 *
 * A 401 on a non-`/auth/` request first tries to renew the session (one renewal shared by all
 * parallel 401s). On success the original request is replayed once with the new token; a replay
 * that 401s again, or a failed renewal, ends the session. `/auth/` URLs never trigger renewal.
 * @param req the outgoing request
 * @param next the next interceptor in the chain
 * @returns an observable that emits the response or rethrows the error
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService: AuthService = inject(AuthService);
  const toastService: ToastService = inject(ToastService);

  const handle = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> =>
    next(request).pipe(
      catchError((error: HttpErrorResponse): Observable<HttpEvent<unknown>> => {
        if (error.status === 401 && !request.url.includes('/auth/')) {
          if (request.context.get(RENEWAL_REPLAY)) {
            authService.handleUnauthorized();
            return throwError((): HttpErrorResponse => error);
          }
          return from(authService.renewSession()).pipe(
            switchMap((renewed: boolean): Observable<HttpEvent<unknown>> => {
              const token: string | null = renewed ? authService.getToken() : null;
              if (!token) {
                authService.handleUnauthorized();
                return throwError((): HttpErrorResponse => error);
              }
              return handle(
                request.clone({
                  setHeaders: { Authorization: `Bearer ${token}` },
                  context: copyContext(request.context).set(RENEWAL_REPLAY, true),
                }),
              );
            }),
          );
        }
        if (!request.context.get(SKIP_GENERIC_ERROR_TOAST)) {
          // Safety-net toast for any failure a call site hasn't opted out of and doesn't
          // otherwise have specific handling for -- see SKIP_GENERIC_ERROR_TOAST above.
          toastService.error('Something went wrong', 'Please try again.');
        }
        return throwError((): HttpErrorResponse => error);
      }),
    );

  return handle(req);
};

/** Copies a context so flagging the replay does not leak into a context the caller reuses. */
function copyContext(source: HttpContext): HttpContext {
  const copy = new HttpContext();
  for (const key of source.keys()) {
    copy.set(key as HttpContextToken<unknown>, source.get(key as HttpContextToken<unknown>));
  }
  return copy;
}
