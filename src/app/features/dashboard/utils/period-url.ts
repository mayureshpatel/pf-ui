import { Params } from '@angular/router';

/** The period presets the dashboard offers. */
export type PeriodPreset = 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'LAST_YEAR' | 'CUSTOM';

/** A selected period: a preset, plus the picked month and year used by a custom period. */
export interface PeriodSelection {
  preset: PeriodPreset;
  /** The month, 1 to 12. Only meaningful for CUSTOM. */
  month: number;
  /** The four-digit year. Only meaningful for CUSTOM. */
  year: number;
}

/** The preset the dashboard opens on, which is left out of the URL. */
const DEFAULT_PRESET: PeriodPreset = 'LAST_MONTH';

const PRESETS: readonly PeriodPreset[] = [
  'THIS_MONTH',
  'LAST_MONTH',
  'THIS_YEAR',
  'LAST_YEAR',
  'CUSTOM',
];

/** The year dropdown offers this many years back from the current one... */
export const YEARS_BACK = 5;
/** ...and this many ahead. */
export const YEARS_AHEAD = 1;

const toInt = (value: unknown, digits: number): number | null => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }
  return typeof value === 'string' && new RegExp(`^\\d{1,${digits}}$`).test(value)
    ? Number(value)
    : null;
};

/**
 * Reads the selected period from the dashboard's query params.
 *
 * Anything unusable (unknown preset, a custom period with a bad month or a year the dropdown does
 * not offer) returns null, so the caller falls back to the default rather than showing a period
 * nobody could have picked.
 *
 * @param params - The route's query params.
 * @param now - The current date, which bounds the offered years.
 * @param fallback - The month and year to report for presets that do not carry their own.
 * @returns The period, or null when the params do not describe a valid one.
 */
export function parsePeriodParams(
  params: Params,
  now: Date,
  fallback: { month: number; year: number },
): PeriodSelection | null {
  const preset = PRESETS.find((candidate: PeriodPreset): boolean => candidate === params['period']);
  if (!preset) {
    return null;
  }

  if (preset !== 'CUSTOM') {
    return { preset, ...fallback };
  }

  const month: number | null = toInt(params['month'], 2);
  const year: number | null = toInt(params['year'], 4);
  const thisYear: number = now.getFullYear();
  if (
    month === null ||
    year === null ||
    month < 1 ||
    month > 12 ||
    year < thisYear - YEARS_BACK ||
    year > thisYear + YEARS_AHEAD
  ) {
    return null;
  }
  return { preset, month, year };
}

/**
 * The query params that describe a period. The default (Last Month) is left out so the plain
 * `/dashboard` URL stays clean.
 *
 * @param preset - The selected preset.
 * @param month - The picked month, used only for CUSTOM.
 * @param year - The picked year, used only for CUSTOM.
 */
export function buildPeriodParams(preset: PeriodPreset, month: number, year: number): Params {
  if (preset === DEFAULT_PRESET) {
    return {};
  }
  return preset === 'CUSTOM' ? { period: preset, month, year } : { period: preset };
}
