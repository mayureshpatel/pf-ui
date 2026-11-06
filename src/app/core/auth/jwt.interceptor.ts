import { HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, Observable, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

/** Renew before sending when the held access token has less than this left. */
const RENEW_BEFORE_EXPIRY_MS = 30_000;

/**
 * Interceptor for adding authorization headers to outgoing requests.
 *
 * Renewal is activity-driven: when a request is about to be sent with a token that expires within
 * 30 seconds, the token is renewed first (shared single-flight). If renewal fails the request is
 * sent as is; it will 401 and the error interceptor ends the session. Never timer-based, so an
 * idle tab never keeps a session alive.
 *
 * @param req the outgoing request
 * @param next the next interceptor in the chain
 */
export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const authService: AuthService = inject(AuthService);

  if (req.url.includes('/auth/')) {
    return next(req);
  }

  const send = (): Observable<HttpEvent<unknown>> => {
    const token: string | null = authService.getToken();
    return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
  };

  const expiresAt: number | null = authService.tokenExpiresAt();
  if (
    authService.getToken() &&
    expiresAt !== null &&
    expiresAt - Date.now() <= RENEW_BEFORE_EXPIRY_MS
  ) {
    return from(authService.renewSession()).pipe(switchMap(send));
  }
  return send();
};
