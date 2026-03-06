import {computed, inject, Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {catchError, Observable, tap, throwError} from 'rxjs';
import {environment} from '@env';
import {AuthRequest, AuthResponse, JwtPayload, RegistrationRequest, User} from '@models/auth.model';
import {StorageService} from '../services/storage.service';
import {ToastService} from '../services/toast.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly router: Router = inject(Router);
  private readonly storage: StorageService = inject(StorageService);
  private readonly toast: ToastService = inject(ToastService);

  private readonly _isAuthenticated: WritableSignal<boolean> = signal<boolean>(this.storage.hasToken());
  private readonly _user: WritableSignal<User | null> = signal<User | null>(this.getUserFromToken());

  readonly isAuthenticated: Signal<boolean> = this._isAuthenticated.asReadonly();
  readonly user: Signal<User | null> = this._user.asReadonly();
  readonly username: Signal<string> = computed(() => this._user()?.username ?? '');

  login(credentials: AuthRequest, rememberMe: boolean): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/authenticate`, credentials)
      .pipe(
        tap((response: AuthResponse): void => {
          this.storage.setToken(response.token, rememberMe);
          this._isAuthenticated.set(true);
          this._user.set(this.getUserFromToken());
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

  register(request: RegistrationRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, request)
      .pipe(
        tap((response: AuthResponse): void => {
          this.storage.setToken(response.token, false);
          this._isAuthenticated.set(true);
          this._user.set(this.getUserFromToken());
          this.toast.success('Welcome! Your account has been created successfully.');
          this.router.navigate(['/dashboard']);
        }),
        catchError((error: any): Observable<never> => {
          let message: string = 'Registration failed. Please try again.';
          if (error.status === 409) {
            message = error.error?.detail || 'Username or email already exists';
          } else if (error.status === 400 && error.error?.validationErrors) {
            message = error.error.validationErrors.map((e: any) => e.message).join('. ');
          }
          return throwError(() => new Error(message));
        })
      );
  }

  logout(): void {
    this.storage.clearToken();
    this._isAuthenticated.set(false);
    this._user.set(null);
    this.toast.info('Logged out');
    this.router.navigate(['/login']);
  }

  handleUnauthorized(): void {
    this.storage.clearToken();
    this._isAuthenticated.set(false);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.storage.getToken();
  }

  private getUserFromToken(): User | null {
    const token: string | null = this.storage.getToken();
    if (!token) return null;

    const payload = this.decodeToken(token);
    if (!payload || this.isTokenExpired(payload)) {
      this.storage.clearToken();
      return null;
    }
    return {
      id: payload.userId,
      username: payload.sub,
      email: payload.email
    };
  }

  private decodeToken(token: string): JwtPayload | null {
    try {
      const parts: string[] = token.split('.');
      if (parts.length !== 3) return null;
      const payload: string = parts[1];
      const decoded: string = atob(payload.replaceAll('-', '+').replaceAll('_', '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private isTokenExpired(payload: JwtPayload): boolean {
    const now: number = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }
}
