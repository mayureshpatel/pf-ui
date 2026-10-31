import { Params } from '@angular/router';
import { fromLocalDateString, toLocalDateString } from '@shared/utils/transaction.utils';
import { NetWorthCompareMode, NetWorthMeasure } from '../models/reports.model';
import { rangePresets } from './explore-helpers';

/** The net worth view's own state: the measure, range, comparison, filters, and where the drill is. */
export interface NetWorthState {
  measure: NetWorthMeasure;
  startDate: string;
  endDate: string;
  rangeLabel: string;
  compare: NetWorthCompareMode;
  /** Accounts the view is limited to; empty means all. */
  accountIds: number[];
  /** The drilled account type, or null at the top. */
  typeCode: string | null;
  /** The drilled account, or null. */
  accountId: number | null;
  /** The month (yyyy-MM) whose accounts are shown, or null for the last month of the range. */
  month: string | null;
}

const MEASURES: NetWorthMeasure[] = ['NET_WORTH', 'ASSETS', 'DEBTS'];
const COMPARES: NetWorthCompareMode[] = ['NONE', 'YEAR_AGO', 'PREVIOUS_PERIOD'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The default view: net worth over the last 12 months, not comparing. */
export function defaultNetWorthState(today: Date = new Date()): NetWorthState {
  const last12 = rangePresets(today).find((p) => p.key === 'last-12-months')!;
  return {
    measure: 'NET_WORTH',
    startDate: last12.startDate,
    endDate: last12.endDate,
    rangeLabel: last12.label,
    compare: 'NONE',
    accountIds: [],
    typeCode: null,
    accountId: null,
    month: null,
  };
}

/** The URL parameters for a state; defaults for the measure, comparison and the empty filters are left out. */
export function toNetWorthParams(state: NetWorthState): Params {
  const params: Params = {
    nwStart: state.startDate,
    nwEnd: state.endDate,
    nwRange: state.rangeLabel,
  };
  if (state.measure !== 'NET_WORTH') params['nwMeasure'] = state.measure;
  if (state.compare !== 'NONE') params['nwCompare'] = state.compare;
  if (state.accountIds.length) params['nwAccounts'] = state.accountIds.join(',');
  if (state.typeCode) params['nwType'] = state.typeCode;
  if (state.accountId !== null) params['nwAccount'] = String(state.accountId);
  if (state.month) params['nwMonth'] = state.month;
  return params;
}

const one = (value: unknown): string | undefined => {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  return first === undefined || first === null || first === '' ? undefined : String(first);
};

const isValidDate = (value: string): boolean =>
  DATE_PATTERN.test(value) && toLocalDateString(fromLocalDateString(value)) === value;

function parseEnum<T extends string>(
  raw: unknown,
  allowed: T[],
  fallback: T,
  problems: string[],
): T {
  const value: string | undefined = one(raw);
  if (value === undefined) return fallback;
  if (allowed.includes(value as T)) return value as T;
  problems.push(`"${value}" isn't a known setting`);
  return fallback;
}

/**
 * Reads a state back from URL parameters, tolerating anything: an unknown value, a bad range, a month
 * outside the range, or a drilled account the account filter excludes falls back, and `note` says so.
 */
export function fromNetWorthParams(
  params: Params,
  today: Date = new Date(),
): { state: NetWorthState; note: string | null } {
  const problems: string[] = [];
  const state: NetWorthState = defaultNetWorthState(today);

  state.measure = parseEnum(params['nwMeasure'], MEASURES, 'NET_WORTH', problems);
  state.compare = parseEnum(params['nwCompare'], COMPARES, 'NONE', problems);

  const start: string | undefined = one(params['nwStart']);
  const end: string | undefined = one(params['nwEnd']);
  if (start !== undefined || end !== undefined) {
    if (start && end && isValidDate(start) && isValidDate(end) && start <= end) {
      state.startDate = start;
      state.endDate = end;
      state.rangeLabel = one(params['nwRange']) ?? 'Custom';
    } else {
      problems.push("the dates weren't valid, so the last 12 months are shown");
    }
  }

  const accounts: string | undefined = one(params['nwAccounts']);
  if (accounts) {
    state.accountIds = accounts
      .split(',')
      .filter((part) => /^\d+$/.test(part))
      .map(Number);
  }
  state.typeCode = one(params['nwType']) ?? null;

  const account: string | undefined = one(params['nwAccount']);
  if (account !== undefined) {
    const id: number = /^\d+$/.test(account) ? Number(account) : NaN;
    if (Number.isNaN(id) || (state.accountIds.length > 0 && !state.accountIds.includes(id))) {
      problems.push("the chosen account isn't one of the accounts shown");
    } else {
      state.accountId = id;
    }
  }

  const month: string | undefined = one(params['nwMonth']);
  if (month !== undefined) {
    if (
      MONTH_PATTERN.test(month) &&
      month >= state.startDate.slice(0, 7) &&
      month <= state.endDate.slice(0, 7)
    ) {
      state.month = month;
    } else {
      problems.push("the chosen month isn't in the range");
    }
  }

  const note: string | null = problems.length
    ? `Some settings in this link couldn't be used (${problems.join('; ')}), so the defaults were applied.`
    : null;
  return { state, note };
}

/** The query parameters the breakdown endpoint takes, by their API names. */
export function toBreakdownParams(state: NetWorthState): Record<string, string> {
  const params: Record<string, string> = {
    startDate: state.startDate,
    endDate: state.endDate,
    groupBy: state.typeCode !== null || state.accountId !== null ? 'ACCOUNT' : 'TYPE',
  };
  if (state.accountIds.length) params['accountIds'] = state.accountIds.join(',');
  if (state.typeCode) params['typeCode'] = state.typeCode;
  if (state.compare !== 'NONE') params['compare'] = state.compare;
  if (state.month) params['asOf'] = state.month;
  return params;
}
