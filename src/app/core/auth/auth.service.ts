import { computed, inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, Observable, tap, throwError } from 'rxjs';
import { environment } from '@env';
import { AuthRequest, AuthResponse, RegistrationRequest, User } from '@models/auth.model';
import { ToastService } from '../services/toast.service';
import { getTokenExpiryMs, getUserFromToken } from './utils/jwt.utils';
import { SKIP_GENERIC_ERROR_TOAST } from './error.interceptor';

/** Legacy browser-storage keys from when the token was persisted; removed at startup. */
const LEGACY_TOKEN_KEY = 'pf_auth_token';
const LEGACY_STORAGE_TYPE_KEY = 'pf_storage_type';

/**
 * Auth calls: no generic error toast, and cookies enabled so the HttpOnly `pf_refresh` cookie is
 * stored on login and sent on refresh/logout (the dev API is cross-origin; prod is same-origin).
 */
const AUTH_OPTIONS = {
  context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true),
  withCredentials: true,
};

/** One field-level entry in a 400 response's `validationErrors` array (see GlobalExceptionHandler). */
interface ValidationErrorItem {
  field: string;
  message: string;
}

/**
 * Service responsible for managing authentication state and user operations.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly router: Router = inject(Router);
  private readonly toast: ToastService = inject(ToastService);

  /**
   * The access token, held in memory only. SECURITY: it is never written to localStorage or
   * sessionStorage, so an XSS payload cannot read a persisted token. It lives 15 minutes; the
   * session itself is kept by the HttpOnly `pf_refresh` cookie, which scripts cannot read.
   */
  private readonly _token: WritableSignal<string | null> = signal<string | null>(null);
  private readonly _isAuthenticated: WritableSignal<boolean> = signal<boolean>(false);
  private readonly _user: WritableSignal<User | null> = signal<User | null>(null);

  constructor() {
    AuthService.removeLegacyStorage();
  }

  /**
   * Epoch milliseconds at which the held access token expires, or null when none is held.
   */
  readonly tokenExpiresAt: Signal<number | null> = computed((): number | null => {
    const token: string | null = this._token();
    return token ? getTokenExpiryMs(token) : null;
  });

  /**
   * Whether the user is currently authenticated.
   */
  readonly isAuthenticated: Signal<boolean> = this._isAuthenticated.asReadonly();

  /**
   * The currently logged-in user, or null if not authenticated.
   */
  readonly user: Signal<User | null> = this._user.asReadonly();

  /**
   * The username of the currently logged-in user, or an empty string.
   */
  readonly username: Signal<string> = computed((): string => this.user()?.username ?? '');

  /**
   * Authenticates the user with the provided credentials.
   *
   * @param credentials - The user credentials (username and password).
   * @param rememberMe - Sent to the server, which issues a persistent (remember-me) or
   *   browser-session refresh cookie accordingly.
   * @returns An observable of the authentication response.
   * @throws An error if authentication fails.
   */
  login(credentials: AuthRequest, rememberMe: boolean): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${environment.apiUrl}/auth/authenticate`,
        { ...credentials, rememberMe },
        AUTH_OPTIONS,
      )
      .pipe(
        tap((response: AuthResponse): void => {
          this.setSession(response.token);
          this.toast.success('Welcome back!');
          this.router.navigate(['/dashboard']);
        }),
        catchError((error: HttpErrorResponse): Observable<never> => {
          const message: string =
            error.status === 401
              ? 'Invalid username or password'
              : 'An error occurred. Please try again.';
          return throwError(() => new Error(message));
        }),
      );
  }

  /**
   * Registers a new user with the provided registration request.
   *
   * @param request - The registration details (username, email, password).
   * @returns An observable of the authentication response.
   * @throws An error if registration fails (e.g., duplicate user).
   */
  register(request: RegistrationRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request, AUTH_OPTIONS)
      .pipe(
        tap((response: AuthResponse): void => {
          this.setSession(response.token);
          this.toast.success('Welcome! Your account has been created successfully.');
          this.router.navigate(['/dashboard']);
        }),
        catchError((error: HttpErrorResponse): Observable<never> => {
          let message = 'Registration failed. Please try again.';
          if (error.status === 409) {
            message = error.error?.detail || 'Username or email already exists';
          } else if (error.status === 400 && error.error?.validationErrors) {
            message = error.error.validationErrors
              .map((e: ValidationErrorItem): string => e.message)
              .join('. ');
          }
          return throwError(() => new Error(message));
        }),
      );
  }

  /**
   * Restores the session from the refresh cookie (page reload or new tab).
   *
   * Runs once at startup from an app initializer, before the router guards. A missing, expired or
   * revoked cookie (401) or any other failure just leaves the user signed out: no toast, no
   * redirect (the guards decide where to go).
   *
   * @returns A promise that resolves to true when a session was restored, never rejects.
   */
  async restoreSession(): Promise<boolean> {
    try {
      const response: AuthResponse = await firstValueFrom(
        this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, null, AUTH_OPTIONS),
      );
      this.setSession(response.token);
      return this.isAuthenticated();
    } catch {
      this.clearSession();
      return false;
    }
  }

  /**
   * Logs out the current user: ends the server session and clears local state.
   *
   * The server call is best effort; local state is cleared and the user sent to /login even
   * when it fails.
   */
  logout(): void {
    this.http.post<void>(`${environment.apiUrl}/auth/logout`, null, AUTH_OPTIONS).subscribe({
      error: (): void => undefined,
    });
    this.clearSession();
    this.toast.info('Logged out');
    this.router.navigate(['/login']);
  }

  /**
   * Resets the authentication state in response to an unauthorized request (e.g., 401).
   */
  handleUnauthorized(): void {
    this.toast.warn('Your session has expired. Please log in again.');
    this.clearSession();
    this.router.navigate(['/login']);
  }

  /**
   * Returns the in-memory access token.
   *
   * @returns The JWT access token or null when signed out.
   */
  getToken(): string | null {
    return this._token();
  }

  private setSession(token: string): void {
    const user: User | null = getUserFromToken(token);
    this._token.set(user ? token : null);
    this._user.set(user);
    this._isAuthenticated.set(user !== null);
  }

  private clearSession(): void {
    this._token.set(null);
    this._user.set(null);
    this._isAuthenticated.set(false);
  }

  /** Deletes the token keys earlier versions persisted; existing users simply sign in again. */
  private static removeLegacyStorage(): void {
    try {
      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem(LEGACY_TOKEN_KEY);
        storage.removeItem(LEGACY_STORAGE_TYPE_KEY);
      }
    } catch {
      // Storage can be unavailable (privacy mode); nothing to clean up then.
    }
  }
}
