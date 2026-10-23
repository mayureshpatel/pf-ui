import { Injectable } from '@angular/core';
import { Params } from '@angular/router';
import { TransactionFilter, TransactionState, TransactionType } from '@models/transaction.model';
import { fromLocalDateString, toLocalDateString } from '@shared/utils/transaction.utils';

/**
 * Reads a date from the URL: plain `yyyy-MM-dd` as local midnight on that day, or (for links
 * saved before dates were written that way) anything `new Date()` understands.
 */
const parseUrlDate = (value: string): Date =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromLocalDateString(value) : new Date(value);

/**
 * Pure translation between the transactions ledger's URL query params and its internal
 * `TransactionState` signal shape. Has no `Router`/`ActivatedRoute` dependency by design, so it's
 * trivially unit-testable in isolation -- `TransactionsComponent` owns the actual route
 * subscription and navigation call, this service only translates between the two shapes.
 */
@Injectable({
  providedIn: 'root',
})
export class TransactionUrlStateService {
  /**
   * Translates URL query parameters into a `TransactionState`.
   * @param params the query parameters from the active route
   */
  hydrateFromParams(params: Params): TransactionState {
    const filter: TransactionFilter = {
      accountId: params['accountId'] ? Number(params['accountId']) : undefined,
      type: (params['type'] as TransactionType) || undefined,
      description: params['description'] || undefined,
      merchant: params['merchant'] || undefined,
      categoryName: params['categoryName'] || undefined,
      minAmount: params['minAmount'] === undefined ? undefined : Number(params['minAmount']),
      maxAmount: params['maxAmount'] === undefined ? undefined : Number(params['maxAmount']),
      startDate: params['startDate'] ? parseUrlDate(params['startDate']) : undefined,
      endDate: params['endDate'] ? parseUrlDate(params['endDate']) : undefined,
      tagId: params['tagId'] ? Number(params['tagId']) : undefined,
    };

    const page: number = params['page'] ? Number(params['page']) : 0;
    const size: number = params['size'] ? Number(params['size']) : 20;
    const sort: string = params['sort'] || 'date,desc';

    return { filter, page, size, sort };
  }

  /**
   * Serializes a `TransactionState` to URL query parameters. Only non-default values are
   * included, matching the ledger's existing "clean URL" behavior.
   * @param state the current transaction state
   */
  buildQueryParams(state: TransactionState): Params {
    const queryParams: Params = {};
    const { filter, page, size, sort } = state;

    if (filter.accountId) queryParams['accountId'] = filter.accountId;
    if (filter.type) queryParams['type'] = filter.type;
    if (filter.description) queryParams['description'] = filter.description;
    if (filter.merchant) queryParams['merchant'] = filter.merchant;
    if (filter.categoryName) queryParams['categoryName'] = filter.categoryName;
    if (filter.minAmount !== undefined) queryParams['minAmount'] = filter.minAmount;
    if (filter.maxAmount !== undefined) queryParams['maxAmount'] = filter.maxAmount;
    if (filter.startDate) queryParams['startDate'] = toLocalDateString(filter.startDate);
    if (filter.endDate) queryParams['endDate'] = toLocalDateString(filter.endDate);
    if (filter.tagId) queryParams['tagId'] = filter.tagId;
    // an explicit marker, so All time survives a refresh instead of falling back to This month
    if (!filter.startDate && !filter.endDate) queryParams['period'] = 'all';

    if (page > 0) queryParams['page'] = page;
    if (size !== 20) queryParams['size'] = size;
    if (sort !== 'date,desc') queryParams['sort'] = sort;

    return queryParams;
  }
}
