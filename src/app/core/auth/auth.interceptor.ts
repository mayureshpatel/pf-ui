import {HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, Observable, throwError} from 'rxjs';
import {AuthService} from './auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService: AuthService = inject(AuthService);
  const token: string | null = authService.getToken();

  let authReq: HttpRequest<unknown> = req;
  if (token && !req.url.includes('/auth/')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse): Observable<never> => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        authService.handleUnauthorized();
      }
      return throwError((): HttpErrorResponse => error);
    })
  );
};
