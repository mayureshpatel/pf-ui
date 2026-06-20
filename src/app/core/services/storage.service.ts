import {Injectable} from '@angular/core';

const TOKEN_KEY = 'pf_auth_token';
const STORAGE_TYPE_KEY = 'pf_storage_type';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private get storage(): Storage {
    const storageType: string | null = localStorage.getItem(STORAGE_TYPE_KEY);
    return storageType === 'local' ? localStorage : sessionStorage;
  }

  getToken(): string | null {
    return this.storage.getItem(TOKEN_KEY);
  }

  /**
   * Sets the JWT token in browser storage.
   *
   * SECURITY TRADE-OFF (Accepted Risk):
   * Storing the JWT in localStorage/sessionStorage exposes it to XSS token theft
   * if a vulnerability exists. This is mitigated by a short token lifetime (1 hour).
   * A more secure approach would use httpOnly cookies and CSRF protection,
   * but browser storage is chosen for SPA architectural simplicity.
   */
  setToken(token: string, rememberMe: boolean): void {
    this.clearToken();

    const storage: Storage = rememberMe ? localStorage : sessionStorage;
    localStorage.setItem(STORAGE_TYPE_KEY, rememberMe ? 'local' : 'session');
    storage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STORAGE_TYPE_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }
}
