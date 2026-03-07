import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {
  Account,
  AccountCreateRequest,
  AccountReconcileRequest,
  AccountType,
  AccountUpdateRequest
} from '@models/account.model';

@Injectable({
  providedIn: 'root'
})
export class AccountApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/accounts`;
  private readonly accountTypeApiUrl = `${environment.apiUrl}/account-types`;

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(this.apiUrl);
  }

  create(data: AccountCreateRequest): Observable<number> {
    return this.http.post<number>(this.apiUrl, data);
  }

  update(data: AccountUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, data);
  }

  reconcile(data: AccountReconcileRequest): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/reconcile`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getAccountTypes(): Observable<AccountType[]> {
    return this.http.get<AccountType[]>(this.accountTypeApiUrl);
  }
}
