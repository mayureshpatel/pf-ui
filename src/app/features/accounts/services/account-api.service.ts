import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  Account,
  AccountCreateRequest,
  AccountReconcileRequest,
  AccountType,
  AccountUpdateRequest,
} from '@models/account.model';
import { Currency } from '@models/currency.model';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';

const SKIP_TOAST_OPTIONS = { context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true) };

@Injectable({
  providedIn: 'root',
})
export class AccountApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.apiUrl}/accounts`;
  private readonly accountTypeApiUrl: string = `${environment.apiUrl}/account-types`;
  private readonly currencyApiUrl: string = `${environment.apiUrl}/currency`;

  /**
   * Gets all accounts for the current user.
   * @returns the list of accounts.
   */
  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(this.apiUrl);
  }

  /**
   * Creates a new account.
   * @param data the account creation payload.
   * @returns the id of the newly created account.
   */
  create(data: AccountCreateRequest): Observable<number> {
    return this.http.post<number>(this.apiUrl, data, SKIP_TOAST_OPTIONS);
  }

  /**
   * Updates an existing account.
   * @param data the account update payload, including its id and optimistic-locking version.
   * @returns the id of the updated account.
   */
  update(data: AccountUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, data, SKIP_TOAST_OPTIONS);
  }

  /**
   * Reconciles an account's balance against a real-world statement, creating an
   * adjustment transaction if they differ.
   * @param data the reconciliation payload.
   * @returns the id of the resulting adjustment transaction, if one was created.
   */
  reconcile(data: AccountReconcileRequest): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/reconcile`, data);
  }

  /**
   * Deletes an account by id.
   * @param id the account id to delete.
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, SKIP_TOAST_OPTIONS);
  }

  /**
   * Gets the available account types (e.g. checking, savings, credit card).
   * @returns the list of account types.
   */
  getAccountTypes(): Observable<AccountType[]> {
    return this.http.get<AccountType[]>(this.accountTypeApiUrl, SKIP_TOAST_OPTIONS);
  }

  /**
   * Gets the available currencies.
   * @returns the list of currencies.
   */
  getCurrencies(): Observable<Currency[]> {
    return this.http.get<Currency[]>(this.currencyApiUrl);
  }
}
