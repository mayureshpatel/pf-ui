/** An inclusive date range expressed as `yyyy-mm-dd` strings. */
export interface DateRange {
  start: string;
  end: string;
}

const DAY_MS = 86_400_000;

const parse = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date): string => date.toISOString().split('T')[0];

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const SHORT_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const SHORT_DATE_WITH_YEAR = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * The window a date range is compared against. Mirrors how `DashboardService.getPulse` picks its
 * comparison period: a range that starts on January 1 and ends in the same year (This Year, Last
 * Year) is compared against the same dates one year earlier, with Feb 29 clamped to Feb 28; any
 * other range is compared against the window of the same inclusive length immediately before it.
 * Whole January is left on the same-length rule, which already lands on the prior December.
 *
 * @param range - The current period.
 * @returns The period it is compared against.
 */
export function previousRange(range: DateRange): DateRange {
  const start: Date = parse(range.start);
  const end: Date = parse(range.end);

  const startsJanuaryFirst: boolean = start.getUTCMonth() === 0 && start.getUTCDate() === 1;
  const sameYear: boolean = start.getUTCFullYear() === end.getUTCFullYear();
  const wholeJanuary: boolean = end.getUTCMonth() === 0 && end.getUTCDate() === 31;
  if (startsJanuaryFirst && sameYear && !wholeJanuary) {
    const year: number = start.getUTCFullYear() - 1;
    const lastDay: number = new Date(Date.UTC(year, end.getUTCMonth() + 1, 0)).getUTCDate();
    return {
      start: toIso(new Date(Date.UTC(year, 0, 1))),
      end: toIso(new Date(Date.UTC(year, end.getUTCMonth(), Math.min(end.getUTCDate(), lastDay)))),
    };
  }

  const days: number = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return {
    start: toIso(new Date(start.getTime() - days * DAY_MS)),
    end: toIso(new Date(start.getTime() - DAY_MS)),
  };
}

/**
 * The whole calendar month for a month and year.
 *
 * @param month - The month, 1 to 12.
 * @param year - The four-digit year.
 */
export function monthRange(month: number, year: number): DateRange {
  return {
    start: toIso(new Date(Date.UTC(year, month - 1, 1))),
    end: toIso(new Date(Date.UTC(year, month, 0))),
  };
}

/**
 * The calendar month before a month and year, wrapping January to the prior December. Mirrors
 * how `DashboardService.getPulse` compares a custom month.
 *
 * @param month - The month, 1 to 12.
 * @param year - The four-digit year.
 */
export function previousMonthRange(month: number, year: number): DateRange {
  return month === 1 ? monthRange(12, year - 1) : monthRange(month - 1, year);
}

/**
 * A short human label for a range: "September 2026" for a full calendar month, otherwise
 * "Oct 1 to Oct 13, 2026" (or with both years when the range spans two).
 *
 * @param range - The range to label.
 */
export function formatRange(range: DateRange): string {
  const start: Date = parse(range.start);
  const end: Date = parse(range.end);

  if (range.start === range.end) {
    return SHORT_DATE_WITH_YEAR.format(start);
  }

  if (isWholeMonth(range)) {
    return MONTH_YEAR.format(start);
  }

  const startLabel: string =
    start.getUTCFullYear() === end.getUTCFullYear()
      ? SHORT_DATE.format(start)
      : SHORT_DATE_WITH_YEAR.format(start);
  return `${startLabel} to ${SHORT_DATE_WITH_YEAR.format(end)}`;
}

/** Whether a range is exactly one whole calendar month. */
function isWholeMonth(range: DateRange): boolean {
  const start: Date = parse(range.start);
  const end: Date = parse(range.end);
  const sameMonth: boolean =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  const lastDay: number = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return sameMonth && start.getUTCDate() === 1 && end.getUTCDate() === lastDay;
}

/**
 * The dashboard header's plain-language subtitle.
 *
 * @param current - The selected period.
 * @param previous - The period the backend compares it against.
 */
export function describePeriod(current: DateRange, previous: DateRange): string {
  if (isWholeMonth(previous) || isSameDatesPriorYear(current, previous)) {
    return `${formatRange(current)} compared with ${formatRange(previous)}`;
  }

  // a same-length window rarely lines up with a calendar month, so say what it is and then
  // where it falls, rather than printing it in a different style from the period itself
  const days: number =
    Math.round((parse(previous.end).getTime() - parse(previous.start).getTime()) / DAY_MS) + 1;
  const length: string = days === 1 ? 'the day before' : `the ${days} days before`;
  return `${formatRange(current)} compared with ${length} (${formatRange(previous)})`;
}

/** Whether `previous` is the same calendar dates as `current`, one year earlier. */
function isSameDatesPriorYear(current: DateRange, previous: DateRange): boolean {
  return (
    current.start.slice(5) === previous.start.slice(5) &&
    Number(current.start.slice(0, 4)) - 1 === Number(previous.start.slice(0, 4)) &&
    Number(current.end.slice(0, 4)) - 1 === Number(previous.end.slice(0, 4))
  );
}
