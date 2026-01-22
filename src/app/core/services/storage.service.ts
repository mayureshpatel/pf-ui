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
