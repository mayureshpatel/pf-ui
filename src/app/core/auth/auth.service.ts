import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { environment } from '@env';
import { AuthRequest, AuthResponse, JwtPayload, User } from '@models/auth.model';
import { StorageService } from '../services/storage.service';
import { ToastService } from '../services/toast.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private storage = inject(StorageService);
  private toast = inject(ToastService);

  private readonly _isAuthenticated = signal<boolean>(this.storage.hasToken());
  private readonly _user = signal<User | null>(this.getUserFromToken());

  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly user = this._user.asReadonly();
  readonly username = computed(() => this._user()?.username ?? '');

  login(credentials: AuthRequest, rememberMe: boolean) {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/authenticate`, credentials)
      .pipe(
        tap((response) => {
          this.storage.setToken(response.token, rememberMe);
          this._isAuthenticated.set(true);
          this._user.set(this.getUserFromToken());
          this.toast.success('Welcome back!');
          this.router.navigate(['/dashboard']);
        }),
        catchError((error) => {
          const message =
            error.status === 401
              ? 'Invalid username or password'
              : 'An error occurred. Please try again.';
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
    const token = this.storage.getToken();
    if (!token) return null;

    try {
      const payload = this.decodeToken(token);
      if (this.isTokenExpired(payload)) {
        this.storage.clearToken();
        return null;
      }
      return {
        id: payload.userId,
        username: payload.sub,
        email: payload.email
      };
    } catch {
      this.storage.clearToken();
      return null;
    }
  }

  private decodeToken(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  }

  private isTokenExpired(payload: JwtPayload): boolean {
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  }
}
