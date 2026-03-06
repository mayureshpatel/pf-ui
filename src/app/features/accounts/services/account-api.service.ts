import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {Account, AccountFormData, AccountType} from '@models/account.model';

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

  create(data: AccountFormData): Observable<number> {
    return this.http.post<number>(this.apiUrl, {
      name: data.accountName,
      type: data.accountType!.code,
      startingBalance: data.currentBalance,
      currencyCode: 'USD',
      bankName: data.bankName ?? undefined
    });
  }

  update(id: number, data: AccountFormData, version: number): Observable<number> {
    return this.http.put<number>(this.apiUrl, {
      id,
      name: data.accountName,
      type: data.accountType!.code,
      currencyCode: 'USD',
      bankName: data.bankName ?? undefined,
      version
    });
  }

  reconcile(accountId: number, newBalance: number, version: number): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/reconcile`, {accountId, newBalance, version});
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getAccountTypes(): Observable<AccountType[]> {
    return this.http.get<AccountType[]>(this.accountTypeApiUrl);
  }
}
