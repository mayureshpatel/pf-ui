import {describe, it, expect, vi, beforeEach} from 'vitest';
import {TestBed} from '@angular/core/testing';
import {HttpContext, HttpErrorResponse, HttpHandlerFn, HttpRequest} from '@angular/common/http';
import {throwError, of} from 'rxjs';
import {errorInterceptor, SKIP_GENERIC_ERROR_TOAST} from './error.interceptor';
import {AuthService} from './auth.service';
import {ToastService} from '../services/toast.service';

describe('errorInterceptor', () => {
  let handleUnauthorized: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handleUnauthorized = vi.fn();
    toastError = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        {provide: AuthService, useValue: {handleUnauthorized}},
        {provide: ToastService, useValue: {error: toastError}}
      ]
    });
  });

  function runWith(status: number, url = '/api/v1/accounts', context = new HttpContext()) {
    const req = new HttpRequest('GET', url, {context});
    const error = new HttpErrorResponse({status});
    const next: HttpHandlerFn = () => throwError(() => error);

    return new Promise<void>((resolve) => {
      TestBed.runInInjectionContext(() => {
        errorInterceptor(req, next).subscribe({
          error: () => resolve()
        });
      });
    });
  }

  it('should call handleUnauthorized on a 401 outside /auth/, without a generic toast', async () => {
    // Arrange & Act
    await runWith(401, '/api/v1/accounts');

    // Assert
    expect(handleUnauthorized).toHaveBeenCalledOnce();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('should show a generic toast for a non-401 failure with no opt-out', async () => {
    // Arrange & Act
    await runWith(500, '/api/v1/accounts');

    // Assert
    expect(handleUnauthorized).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledOnce();
  });

  it('should not show a generic toast when the request opts out via SKIP_GENERIC_ERROR_TOAST', async () => {
    // Arrange
    const context = new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true);

    // Act
    await runWith(500, '/api/v1/accounts', context);

    // Assert
    expect(toastError).not.toHaveBeenCalled();
  });

  it('should not treat a 401 on an /auth/ route as an unauthorized session', async () => {
    // Arrange & Act
    await runWith(401, '/api/v1/auth/authenticate');

    // Assert
    expect(handleUnauthorized).not.toHaveBeenCalled();
    // falls through to the generic toast, since it's not opted out and not the handled-401 case
    expect(toastError).toHaveBeenCalledOnce();
  });

  it('should pass through a successful response unchanged', async () => {
    // Arrange
    const req = new HttpRequest('GET', '/api/v1/accounts', {context: new HttpContext()});
    const next: HttpHandlerFn = () => of({type: 4} as any);

    // Act & Assert
    await new Promise<void>((resolve) => {
      TestBed.runInInjectionContext(() => {
        errorInterceptor(req, next).subscribe({
          next: (event) => {
            expect(event).toEqual({type: 4});
            resolve();
          }
        });
      });
    });
    expect(handleUnauthorized).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});
