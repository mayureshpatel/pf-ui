import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {Account} from '@models/account.model';

@Injectable({
  providedIn: 'root'
})
export class AccountApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/accounts`;

  /**
   * Gets all accounts from the api for the current user.
   * @returns the accounts
   */
  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(this.apiUrl);
  }

  /**
   * Creates a new account for the current user.
   * @param account the account to create
   * @returns the created account
   */
  create(account: Account): Observable<Account> {
    return this.http.post<Account>(this.apiUrl, account);
  }

  /**
   * Updates an existing account for the current user.
   * @param id the id of the account to update
   * @param account the account to update
   * @returns the updated account
   */
  update(id: number, account: Account): Observable<Account> {
    return this.http.put<Account>(`${this.apiUrl}/${id}`, account);
  }

  /**
   * Reconciles an account.
   * @param id the id of the account to reconcile
   * @param targetBalance the target balance
   * @returns the reconciled account
   */
  reconcile(id: number, targetBalance: number): Observable<Account> {
    return this.http.post<Account>(`${this.apiUrl}/${id}/reconcile`, {targetBalance});
  }

  /**
   * Deletes an account.
   * @param id the id of the account to delete
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
