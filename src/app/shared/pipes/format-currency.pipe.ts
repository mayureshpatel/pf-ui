import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a number as currency, USD by default.
 * <br><br>
 * Example:
 * <pre>
 *   {{ 1234567.89 | formatCurrency }}
 *   <!-- Results in: $1,234,567.89 -->
 *
 *   {{ 1234567.89 | formatCurrency: false }}
 *   <!-- Results in: $1,234,567 -->
 *
 *   {{ 1234567.89 | formatCurrency: true : 'EUR' }}
 *   <!-- Results in: €1,234,567.89 -->
 * </pre>
 */
@Pipe({
  name: 'formatCurrency',
})
export class FormatCurrencyPipe implements PipeTransform {
  /**
   * Formats a number as currency.
   * @param value the number to format
   * @param showCents whether to show cents (default: true)
   * @param currencyCode the ISO 4217 currency code to format as (default: 'USD')
   * @returns formatted currency string, formatting 0 if value is null or undefined
   */
  transform(value: number | null | undefined, showCents = true, currencyCode = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(value ?? 0);
  }
}
