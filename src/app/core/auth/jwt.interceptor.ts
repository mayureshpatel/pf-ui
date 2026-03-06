import {HttpHandlerFn, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {inject} from '@angular/core';
import {AuthService} from './auth.service';

/**
 * Interceptor for adding authorization headers to outgoing requests.
 * @param req the outgoing request
 * @param next the next interceptor in the chain
 */
export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService: AuthService = inject(AuthService);
  const token: string | null = authService.getToken();

  if (token && !req.url.includes('/auth/')) {
    const authReq: HttpRequest<unknown> = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(authReq);
  }

  return next(req);
};
