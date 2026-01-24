import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { Account, AccountFormData } from '@models/account.model';

@Injectable({
  providedIn: 'root'
})
export class AccountApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/accounts`;

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(this.apiUrl);
  }

  createAccount(data: AccountFormData): Observable<Account> {
    return this.http.post<Account>(this.apiUrl, data);
  }

  updateAccount(id: number, data: AccountFormData): Observable<Account> {
    return this.http.put<Account>(`${this.apiUrl}/${id}`, data);
  }

  deleteAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
