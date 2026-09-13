import { FilterMetadata } from 'primeng/api';
import { TransactionFilter } from '@models/transaction.model';

type FilterEvent = FilterMetadata | FilterMetadata[] | undefined;

/**
 * Generic PrimeNG `<p-table>` filter-event -> `TransactionFilter` translation for a single
 * equals-match field (category/account/tag today: same shape, different field name).
 * @param metadata the filter event for this column
 * @param stateFilter the transaction filter state to write into
 * @param field the `TransactionFilter` key this column corresponds to
 */
export function setEqualsFilter<K extends 'categoryName' | 'accountId' | 'tagId'>(
  metadata: FilterEvent,
  stateFilter: TransactionFilter,
  field: K,
): void {
  if (metadata) {
    const m: FilterMetadata = Array.isArray(metadata) ? metadata[0] : metadata;
    stateFilter[field] = (m.value || undefined) as TransactionFilter[K];
  } else {
    stateFilter[field] = undefined;
  }
}

/**
 * Translates the date column's filter event (single `dateIs`, or a `dateAfter`/`dateBefore`
 * pair) into `TransactionFilter`'s `startDate`/`endDate`.
 * @param dateFilter the date column's filter event
 * @param stateFilter the transaction filter state to write into
 */
export function setDateFilter(dateFilter: FilterEvent, stateFilter: TransactionFilter): void {
  if (dateFilter) {
    const metadata: FilterMetadata[] = Array.isArray(dateFilter) ? dateFilter : [dateFilter];
    stateFilter.startDate = undefined;
    stateFilter.endDate = undefined;

    metadata.forEach((m: FilterMetadata): void => {
      if (m.value) {
        const dateValue = new Date(m.value);
        if (m.matchMode === 'dateIs') {
          stateFilter.startDate = dateValue;
          stateFilter.endDate = dateValue;
        } else if (m.matchMode === 'dateAfter') {
          stateFilter.startDate = dateValue;
        } else if (m.matchMode === 'dateBefore') {
          stateFilter.endDate = dateValue;
        }
      }
    });
  } else {
    stateFilter.startDate = undefined;
    stateFilter.endDate = undefined;
  }
}

/**
 * Translates the merchant/description column's filter event into `TransactionFilter`'s
 * `merchant`/`description`.
 * @param merchantFilter the merchant/description column's filter event
 * @param stateFilter the transaction filter state to write into
 */
export function setMerchantFilter(
  merchantFilter: FilterEvent,
  stateFilter: TransactionFilter,
): void {
  if (merchantFilter) {
    const metadata: FilterMetadata = Array.isArray(merchantFilter)
      ? merchantFilter[0]
      : merchantFilter;
    const value = metadata.value as { merchant?: string; description?: string } | null;
    stateFilter.merchant = value?.merchant || undefined;
    stateFilter.description = value?.description || undefined;
  } else {
    stateFilter.merchant = undefined;
    stateFilter.description = undefined;
  }
}

/**
 * Translates the amount column's filter event into `TransactionFilter`'s
 * `minAmount`/`maxAmount`/`type`.
 * @param amountFilter the amount column's filter event
 * @param stateFilter the transaction filter state to write into
 */
export function setAmountFilter(amountFilter: FilterEvent, stateFilter: TransactionFilter): void {
  if (amountFilter) {
    const metadata: FilterMetadata = Array.isArray(amountFilter) ? amountFilter[0] : amountFilter;
    const value = metadata.value as { min?: number; max?: number; type?: string } | null;
    stateFilter.minAmount = value?.min ?? undefined;
    stateFilter.maxAmount = value?.max ?? undefined;
    stateFilter.type = (value?.type ?? undefined) as TransactionFilter['type'];
  } else {
    stateFilter.minAmount = undefined;
    stateFilter.maxAmount = undefined;
    stateFilter.type = undefined;
  }
}

/**
 * Generic inline-filter-editor -> `FilterMetadata.value` updater for a composite filter value
 * (e.g. `{merchant, description}` or `{min, max, type}`), where the constraint clears entirely
 * (`value = null`) once every field in the composite is empty. Preserves each field's existing
 * value in the composite except the one being changed.
 * @param filterConstraint the PrimeNG filter constraint being edited
 * @param fieldNames every field name in this composite value, in no particular order
 * @param changedField which field is being changed
 * @param rawValue the new raw value for that field
 * @param options `normalize` turns the raw value into the value actually stored (defaults to
 *   identity -- only the description field trims); `isEmpty` decides whether a given field's
 *   value counts as "empty" for the all-empty-clears-the-constraint check (defaults to a strict
 *   null/undefined check, since `0` is a meaningful, non-empty amount -- the merchant/description
 *   pair overrides this to a plain falsy check, matching their original behavior)
 */
export function updateCompositeFilterField<T extends Record<string, unknown>>(
  filterConstraint: FilterMetadata,
  fieldNames: (keyof T)[],
  changedField: keyof T,
  rawValue: unknown,
  options?: {
    normalize?: (v: unknown) => unknown;
    isEmpty?: (v: unknown) => boolean;
  },
): void {
  const normalize: (v: unknown) => unknown = options?.normalize ?? ((v: unknown): unknown => v);
  const isEmpty: (v: unknown) => boolean =
    options?.isEmpty ?? ((v: unknown): boolean => v === null || v === undefined);

  const current = (filterConstraint.value ?? {}) as Partial<T>;
  const merged: Partial<T> = { ...current, [changedField]: normalize(rawValue) };

  const allEmpty: boolean = fieldNames.every((key: keyof T): boolean => isEmpty(merged[key]));
  filterConstraint.value = allEmpty ? null : merged;
}
