import {HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, Observable, throwError} from 'rxjs';
import {AuthService} from './auth.service';

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

  return next(req).pipe(
    catchError((error: HttpErrorResponse): Observable<never> => {
      // Handle 401 Unauthorized globally
      if (error.status === 401 && !req.url.includes('/auth/')) {
        authService.handleUnauthorized();
      }
      return throwError((): HttpErrorResponse => error);
    })
  );
};
