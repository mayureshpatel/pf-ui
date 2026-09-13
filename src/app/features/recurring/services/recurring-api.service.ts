import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpContext} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {
  RecurringSuggestion,
  RecurringTransaction,
  RecurringTransactionCreateRequest,
  RecurringTransactionUpdateRequest
} from '@models/recurring.model';
import {SKIP_GENERIC_ERROR_TOAST} from '@core/auth/error.interceptor';

const SKIP_TOAST_OPTIONS = {context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true)};

/**
 * Service responsible for managing recurring transactions and subscription patterns.
 *
 * Provides endpoints for CRUD operations on recurring entries and for
 * retrieving pattern-based suggestions from transaction history.
 */
@Injectable({
  providedIn: 'root'
})
export class RecurringApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.apiUrl}/recurring`;

  /**
   * Retrieves all recurring transactions for the current user.
   * @returns An observable array of recurring transactions.
   */
  getAll(): Observable<RecurringTransaction[]> {
    return this.http.get<RecurringTransaction[]>(this.apiUrl, SKIP_TOAST_OPTIONS);
  }

  /**
   * Retrieves automatically detected recurring pattern suggestions.
   * @returns An observable array of suggested recurring transactions.
   */
  getSuggestions(): Observable<RecurringSuggestion[]> {
    return this.http.get<RecurringSuggestion[]>(`${this.apiUrl}/suggestions`, SKIP_TOAST_OPTIONS);
  }

  /**
   * Creates a new recurring transaction record.
   * @param request - The payload containing merchant, account, amount, and frequency details.
   * @returns An observable of the newly created transaction.
   */
  create(request: RecurringTransactionCreateRequest): Observable<RecurringTransaction> {
    return this.http.post<RecurringTransaction>(this.apiUrl, request);
  }

  /**
   * Updates an existing recurring transaction record.
   * @param request - The updated transaction details, including the record ID.
   * @returns An observable of the updated transaction record.
   */
  update(request: RecurringTransactionUpdateRequest): Observable<RecurringTransaction> {
    return this.http.put<RecurringTransaction>(this.apiUrl, request);
  }

  /**
   * Deletes a recurring transaction record.
   * @param id - The unique identifier of the recurring transaction.
   * @returns An observable that completes when the deletion is successful.
   */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, SKIP_TOAST_OPTIONS);
  }
}
