/**
 * Converts a date string to a localized format.
 * The default format is "MM/DD/YYYY" with English locale.
 * @param dateString The date string to format.
 * @param formatOptions
 * @param locale The locale to use for formatting the date.
 */
export function convertDateString(
  dateString: string,
  formatOptions?: Intl.DateTimeFormatOptions,
  locale?: Intl.LocalesArgument
): string {
  formatOptions ??= {year: 'numeric', month: 'short', day: 'numeric'};
  locale ??= 'en-US';

  return new Date(dateString).toLocaleDateString(locale, formatOptions);
}

/**
 * Formats a Date's *local* calendar date as an ISO-style "yyyy-MM-dd" string.
 *
 * Deliberately does not go through `toISOString()`, which normalizes to UTC first --
 * for a Date built from local components (e.g. a date picker), that silently shifts the
 * extracted date backward by a day for any user in a positive UTC offset during the hours
 * local time has already crossed midnight but UTC hasn't yet (PF-199).
 *
 * @param date The date to format, using its local year/month/day.
 */
export function toLocalDateString(date: Date): string {
  const year: number = date.getFullYear();
  const month: string = String(date.getMonth() + 1).padStart(2, '0');
  const day: string = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a plain "yyyy-MM-dd" date (the transaction form's own raw value) into the
 * midnight-UTC ISO datetime string the backend's `transactionDate` field requires. Without this,
 * `TransactionCreateRequest`/`TransactionUpdateRequest` fail Jackson deserialization server-side
 * (`OffsetDateTime` can't parse a bare date), so both the create and update transaction forms
 * were unconditionally rejected with a 400 on submit.
 *
 * @param plainDate a "yyyy-MM-dd" string, as produced by the transaction form's date picker
 */
export function toApiDateTimeString(plainDate: string): string {
  return `${plainDate}T00:00:00Z`;
}
