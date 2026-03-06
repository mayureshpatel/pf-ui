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
