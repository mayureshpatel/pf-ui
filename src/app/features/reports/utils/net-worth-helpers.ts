import { Params } from '@angular/router';
import {
  NetWorthGroup,
  NetWorthMeasure,
  NetWorthMoved,
  NetWorthPoint,
} from '../models/reports.model';
import { defaultState, toQueryParams } from './explore-state';
import { NetWorthState } from './net-worth-state';

export type ChangeTone = 'good' | 'bad' | 'neutral';

const WHOLE_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const MONTH_NAMES: string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** A percentage to one decimal with a trailing ".0" dropped: 12, 9.1. */
function percent(value: number): string {
  return `${Number(Math.abs(value).toFixed(1))}%`;
}

/**
 * How a row moved against its comparison balance (or, with no comparison, against the balance before the
 * range), in words with an arrow. An asset rising is good; a debt falling (the balance moving toward zero)
 * is good and reads "debt down".
 */
export function changeForGroup(group: NetWorthGroup): { text: string; tone: ChangeTone } {
  const baseline: number = group.comparisonBalance ?? group.previousBalance;
  const diff: number = group.balance - baseline;
  if (diff === 0) return { text: 'no change', tone: 'neutral' };
  const debt: boolean = group.kind === 'DEBT';
  // for a debt, more owed is a more negative balance
  const grew: boolean = debt ? diff < 0 : diff > 0;
  const arrow: string = grew ? '▲' : '▼';
  const word = `${debt ? 'debt ' : ''}${grew ? 'up' : 'down'}`;
  const size: string =
    baseline === 0 ? WHOLE_DOLLARS.format(Math.abs(diff)) : percent((diff / baseline) * 100);
  return {
    text: `${arrow} ${word} ${size}`,
    tone: debt ? (grew ? 'bad' : 'good') : grew ? 'good' : 'bad',
  };
}

/** "paid down $4,350" for debt that fell by that much (a positive number), the reverse when it rose. */
export function debtPaidDownText(decrease: number): string {
  if (decrease === 0) return 'no change';
  return decrease > 0
    ? `paid down ${WHOLE_DOLLARS.format(decrease)}`
    : `grew by ${WHOLE_DOLLARS.format(-decrease)}`;
}

/** "covers 4.1 months of spending", or a dash when there is no spending to compare with. */
export function monthsCoveredText(months: number | null): string {
  if (months === null) return '—';
  const rounded: number = Math.round(months * 10) / 10;
  return `covers ${rounded === 1 ? '1 month' : `${rounded.toFixed(1)} months`} of spending`;
}

/** The what-moved-it rows, with the wording the spec fixes. */
export function movedRows(moved: NetWorthMoved): { label: string; amount: number }[] {
  return [
    { label: 'Saved: income minus spending', amount: moved.saved },
    { label: 'Investment growth and other adjustments', amount: moved.other },
    { label: 'Total change', amount: moved.change },
  ];
}

/** A month end as yyyy-MM, the form the month filter and the API use. */
export function pointMonth(date: string): string {
  return date.slice(0, 7);
}

/**
 * The series the chart draws: assets above zero, debts as negatives below it, net worth as a line. Choosing
 * Assets or Debts leaves the other series (and net worth) empty. Labels carry the year only when the range
 * crosses one.
 */
export function chartData(
  points: NetWorthPoint[],
  measure: NetWorthMeasure,
): { labels: string[]; assets: number[]; debts: number[]; netWorth: number[] } {
  const years = new Set<string>(points.map((p) => p.date.slice(0, 4)));
  const labels: string[] = points.map((p) => {
    const name: string = MONTH_NAMES[Number(p.date.slice(5, 7)) - 1];
    return years.size > 1 ? `${name} ${p.date.slice(2, 4)}` : name;
  });
  return {
    labels,
    assets: measure === 'DEBTS' ? [] : points.map((p) => p.assets),
    debts: measure === 'ASSETS' ? [] : points.map((p) => -p.debts),
    netWorth: measure === 'NET_WORTH' ? points.map((p) => p.netWorth) : [],
  };
}

const round1 = (value: number): number => Number(value.toFixed(1));

/**
 * An SVG path for a small trend line, scaled to the box. A gap (null) breaks the line, a lone point draws
 * nothing, and the empty string means there is nothing to draw.
 */
export function sparkline(series: (number | null)[], width = 80, height = 24): string {
  const values: number[] = series.filter((v): v is number => v !== null);
  if (values.length < 2) return '';
  const min: number = Math.min(...values);
  const max: number = Math.max(...values);
  const step: number = series.length > 1 ? width / (series.length - 1) : 0;
  const y = (v: number): number =>
    max === min ? height / 2 : height - ((v - min) / (max - min)) * height;
  const segments: string[][] = [];
  let current: string[] = [];
  series.forEach((value, i) => {
    if (value === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'}${round1(i * step)},${round1(y(value))}`);
  });
  if (current.length) segments.push(current);
  return segments
    .filter((segment) => segment.length >= 2)
    .map((segment) => segment.join(' '))
    .join(' ');
}

/** The explorer's URL for one account: spending by category over the net worth range. */
export function accountExplorerQuery(
  account: NetWorthGroup,
  state: NetWorthState,
  today: Date = new Date(),
): Params {
  return toQueryParams({
    ...defaultState(today),
    startDate: state.startDate,
    endDate: state.endDate,
    rangeLabel: state.rangeLabel,
    filters: { accountIds: [Number(account.key)] },
  });
}

/** The Accounts page's URL parameters for one account. */
export function accountsQuery(accountId: number): Params {
  return { accountId };
}

/** A row's balance as a percentage of all assets; a debt, or no assets at all, is zero. */
export function shareOfAssets(group: NetWorthGroup, totalAssets: number): number {
  if (group.kind === 'DEBT' || totalAssets <= 0) return 0;
  return Math.min(100, Math.max(0, (group.balance / totalAssets) * 100));
}
