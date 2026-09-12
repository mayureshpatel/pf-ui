import {describe, it, expect} from 'vitest';
import {FormatCurrencyPipe} from './format-currency.pipe';

describe('FormatCurrencyPipe', () => {
  const pipe = new FormatCurrencyPipe();

  it('should format a positive number as USD with cents by default', () => {
    // Arrange & Act
    const result = pipe.transform(1234567.89);

    // Assert
    expect(result).toBe('$1,234,567.89');
  });

  it('should omit cents when showCents is false', () => {
    // Arrange & Act
    const result = pipe.transform(1234567.89, false);

    // Assert
    expect(result).toBe('$1,234,568');
  });

  it('should format 0 for null, matching pre-existing callers that never pass a currencyCode (PF-284)', () => {
    // Arrange & Act
    const result = pipe.transform(null);

    // Assert
    expect(result).toBe('$0.00');
  });

  it('should format 0 for undefined', () => {
    // Arrange & Act
    const result = pipe.transform(undefined);

    // Assert
    expect(result).toBe('$0.00');
  });

  it('should format in a dynamic currency code when one is passed (PF-284)', () => {
    // Arrange & Act
    const result = pipe.transform(1234.5, true, 'EUR');

    // Assert
    expect(result).toBe('€1,234.50');
  });

  it("should format a null value in the requested currency, not hardcode '$0.00' (PF-284 regression guard)", () => {
    // Arrange & Act
    const result = pipe.transform(null, true, 'EUR');

    // Assert
    expect(result).toBe('€0.00');
  });
});
