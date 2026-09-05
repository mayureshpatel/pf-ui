import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  Transaction,
  TransactionFilter,
  TransactionCreateRequest,
  TransactionUpdateRequest,
  PageRequest,
  PageResponse,
  TransferSuggestion
} from '@models/transaction.model';
import {Category} from '@models/category.model';
import {toLocalDateString} from '@shared/utils/transaction.utils';

@Injectable({
  providedIn: 'root'
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
    pageRequest: PageRequest
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
      const categoryVal: string = filter.categoryName === '__UNDEFINED__' ? '' : filter.categoryName;
      params = params.set('categoryName', categoryVal);
    }
    if (filter.merchant) params = params.set('merchantCleanName', filter.merchant);
    if (filter.minAmount) params = params.set('minAmount', filter.minAmount.toString());
    if (filter.maxAmount) params = params.set('maxAmount', filter.maxAmount.toString());
    if (filter.startDate) params = params.set('startDate', toLocalDateString(filter.startDate));
    if (filter.endDate) params = params.set('endDate', toLocalDateString(filter.endDate));
    if (filter.tagId) params = params.set('tagId', filter.tagId.toString());

    return this.http.get<PageResponse<Transaction>>(this.apiUrl, { params });
  }

  /**
   * Creates a new transaction.
   * @param data the transaction creation payload.
   * @returns the id of the newly created transaction.
   */
  createTransaction(data: TransactionCreateRequest): Observable<number> {
    return this.http.post<number>(this.apiUrl, data);
  }

  /**
   * Updates an existing transaction.
   * @param data the transaction update payload, including its id.
   * @returns the id of the updated transaction.
   */
  updateTransaction(data: TransactionUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, data);
  }

  /**
   * Deletes a transaction by id.
   * @param id the transaction id to delete.
   */
  deleteTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
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
    return this.http.patch<number>(`${this.apiUrl}/bulk`, updates);
  }

  /**
   * Gets transfer-matching suggestions: pairs of transactions that likely represent
   * the same transfer between two of the user's own accounts.
   * @returns the list of suggested transfer matches.
   */
  getTransferSuggestions(): Observable<TransferSuggestion[]> {
    return this.http.get<TransferSuggestion[]>(`${this.apiUrl}/suggestions/transfers`);
  }

  /**
   * Marks the given transactions as a confirmed transfer.
   * @param ids the transaction ids to mark as transferred.
   */
  markAsTransfer(ids: number[]): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/mark-as-transfer`, ids);
  }

  /**
   * Gets transaction counts grouped by category.
   * @returns the categories with their transaction counts.
   */
  getCountsByCategory(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/count-by-category`);
  }
}
