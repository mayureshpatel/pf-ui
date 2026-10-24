import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env';
import {
  Transaction,
  TransactionFilter,
  TransactionCreateRequest,
  TransactionUpdateRequest,
  PageRequest,
  PageResponse,
  TransferSuggestion,
} from '@models/transaction.model';
import { Category } from '@models/category.model';
import { toLocalDateString } from '@shared/utils/transaction.utils';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';

const SKIP_TOAST_CONTEXT = new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true);
const SKIP_TOAST_OPTIONS = { context: SKIP_TOAST_CONTEXT };

@Injectable({
  providedIn: 'root',
})
export class TransactionApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.apiUrl}/transactions`;

  /**
   * Gets a paginated, filtered page of transactions.
   * @param filter the filter criteria to apply.
   * @param pageRequest the page number, size, and sort to request.
   * @returns the requested page of transactions.
   */
  getTransactions(
    filter: TransactionFilter,
    pageRequest: PageRequest,
  ): Observable<PageResponse<Transaction>> {
    let params: HttpParams = new HttpParams()
      .set('page', pageRequest.page.toString())
      .set('size', pageRequest.size.toString());

    if (pageRequest.sort) {
      params = params.set('sort', pageRequest.sort);
    }

    // Add filter parameters
    if (filter.accountId) params = params.set('accountId', filter.accountId.toString());
    if (filter.type) params = params.set('type', filter.type);
    if (filter.description) params = params.set('description', filter.description);
    if (filter.categoryName) {
      const categoryVal: string =
        filter.categoryName === '__UNDEFINED__' ? '' : filter.categoryName;
      params = params.set('categoryName', categoryVal);
    }
    // PF-810: the backend's query param is `vendorName`, not `merchantCleanName` -- confirmed
    // live against the real running backend that the old name was silently ignored, meaning this
    // filter never actually worked.
    if (filter.merchant) params = params.set('vendorName', filter.merchant);
    if (filter.minAmount) params = params.set('minAmount', filter.minAmount.toString());
    if (filter.maxAmount) params = params.set('maxAmount', filter.maxAmount.toString());
    if (filter.startDate) params = params.set('startDate', toLocalDateString(filter.startDate));
    if (filter.endDate) params = params.set('endDate', toLocalDateString(filter.endDate));
    if (filter.tagId) params = params.set('tagId', filter.tagId.toString());

    return this.http.get<PageResponse<Transaction>>(this.apiUrl, {
      params,
      context: SKIP_TOAST_CONTEXT,
    });
  }

  /**
   * Creates a new transaction.
   * @param data the transaction creation payload.
   * @returns the id of the newly created transaction.
   */
  createTransaction(data: TransactionCreateRequest): Observable<number> {
    return this.http.post<number>(this.apiUrl, data, SKIP_TOAST_OPTIONS);
  }

  /**
   * Updates an existing transaction.
   * @param data the transaction update payload, including its id.
   * @returns the id of the updated transaction.
   */
  updateTransaction(data: TransactionUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, data, SKIP_TOAST_OPTIONS);
  }

  /**
   * Deletes a transaction by id.
   * @param id the transaction id to delete.
   */
  deleteTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, SKIP_TOAST_OPTIONS);
  }

  /**
   * Deletes multiple transactions by id in a single request.
   * @param ids the transaction ids to delete.
   */
  bulkDeleteTransactions(ids: number[]): Observable<void> {
    return this.http.request<void>('delete', `${this.apiUrl}/bulk`, { body: ids });
  }

  /**
   * Updates multiple transactions in a single request.
   * @param updates the transaction update payloads, each including its id.
   * @returns the number of transactions updated.
   */
  bulkUpdateTransactions(updates: TransactionUpdateRequest[]): Observable<number> {
    return this.http.patch<number>(`${this.apiUrl}/bulk`, updates, SKIP_TOAST_OPTIONS);
  }

  /**
   * Gets transfer-matching suggestions: pairs of transactions that likely represent
   * the same transfer between two of the user's own accounts.
   * @returns the list of suggested transfer matches.
   */
  getTransferSuggestions(): Observable<TransferSuggestion[]> {
    return this.http.get<TransferSuggestion[]>(
      `${this.apiUrl}/suggestions/transfers`,
      SKIP_TOAST_OPTIONS,
    );
  }

  /**
   * Marks the given transactions as a confirmed transfer.
   * @param ids the transaction ids to mark as transferred.
   */
  markAsTransfer(ids: number[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/mark-as-transfer`, ids, SKIP_TOAST_OPTIONS);
  }

  /**
   * Reverts the given transactions from a confirmed transfer back to plain income/expense.
   * @param ids the transaction ids to unmark.
   */
  unmarkAsTransfer(ids: number[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/unmark-as-transfer`, ids, SKIP_TOAST_OPTIONS);
  }

  /**
   * Gets transaction counts grouped by category. The backend answers with
   * `{ category, transactionCount }` rows; they are flattened here into categories that carry
   * their own `transactionCount`, so callers can look them up by `id`.
   * @returns the categories that have transactions, each with its count.
   */
  getCountsByCategory(): Observable<Category[]> {
    return this.http
      .get<{ category: Category; transactionCount: number }[]>(
        `${this.apiUrl}/count-by-category`,
        SKIP_TOAST_OPTIONS,
      )
      .pipe(
        map((rows: { category: Category; transactionCount: number }[]): Category[] =>
          rows.map((row): Category => ({
            ...row.category,
            transactionCount: row.transactionCount,
          })),
        ),
      );
  }
}
