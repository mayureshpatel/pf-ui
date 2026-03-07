import {computed, inject, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {catchError, Observable, tap, throwError} from 'rxjs';
import {environment} from '@env';
import {AuthRequest, AuthResponse, RegistrationRequest, User} from '@models/auth.model';
import {StorageService} from '../services/storage.service';
import {ToastService} from '../services/toast.service';
import {getUserFromToken} from './utils/jwt.utils';

/**
 * Service responsible for managing authentication state and user operations.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly router: Router = inject(Router);
  private readonly storage: StorageService = inject(StorageService);
  private readonly toast: ToastService = inject(ToastService);

  private readonly _isAuthenticated: WritableSignal<boolean> = signal<boolean>(this.storage.hasToken());
  private readonly _user: WritableSignal<User | null> = signal<User | null>(getUserFromToken(this.storage.getToken()));

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
   * @param rememberMe - Whether to store the token in local storage (persistent) or session storage.
   * @returns An observable of the authentication response.
   * @throws An error if authentication fails.
   */
  login(credentials: AuthRequest, rememberMe: boolean): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/authenticate`, credentials)
      .pipe(
        tap((response: AuthResponse): void => {
          this.storage.setToken(response.token, rememberMe);
          this._isAuthenticated.set(true);
          this._user.set(getUserFromToken(response.token));
          this.toast.success('Welcome back!');
          this.router.navigate(['/dashboard']);
        }),
        catchError((error: any): Observable<never> => {
          const message: string =
            error.status === 401
              ? 'Invalid username or password'
              : 'An error occurred. Please try again.';
          return throwError(() => new Error(message));
        })
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
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
      .pipe(
        tap((response: AuthResponse): void => {
          this.storage.setToken(response.token, false);
          this._isAuthenticated.set(true);
          this._user.set(getUserFromToken(response.token));
          this.toast.success('Welcome! Your account has been created successfully.');
          this.router.navigate(['/dashboard']);
        }),
        catchError((error: any): Observable<never> => {
          let message: string = 'Registration failed. Please try again.';
          if (error.status === 409) {
            message = error.error?.detail || 'Username or email already exists';
          } else if (error.status === 400 && error.error?.validationErrors) {
            message = error.error.validationErrors.map((e: any): string => e.message).join('. ');
          }
          return throwError(() => new Error(message));
        })
      );
  }

  /**
   * Logs out the current user and clears all stored authentication data.
   */
  logout(): void {
    this.storage.clearToken();
    this._isAuthenticated.set(false);
    this._user.set(null);
    this.toast.info('Logged out');
    this.router.navigate(['/login']);
  }

  /**
   * Resets the authentication state in response to an unauthorized request (e.g., 401).
   */
  handleUnauthorized(): void {
    this.storage.clearToken();
    this._isAuthenticated.set(false);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Retrieves the current user's JWT token from storage.
   *
   * @returns The JWT token or null if no token is stored.
   */
  getToken(): string | null {
    return this.storage.getToken();
  }
}
