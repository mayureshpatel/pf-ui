import {Pipe, PipeTransform} from '@angular/core';

/**
 * Formats a number as USD currency.
 * <br><br>
 * Example:
 * <pre>
 *   {{ 1234567.89 | formatCurrency }}
 *   <!-- Results in: $1,234,567.89 -->
 * </pre>
 */
@Pipe({
  name: 'formatCurrency'
})
export class FormatCurrencyPipe implements PipeTransform {
  /**
   * Formats a number as USD currency.
   * @param value the number to format
   * @param showCents whether to show cents (default: true)
   * @returns formatted currency string or '$0.00' if value is null or undefined
   */
  transform(value: number | null | undefined, showCents: boolean = true): string {
    console.log(value);
    if (value === null || value === undefined) {
      return '$0.00';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(value);
  }
}
