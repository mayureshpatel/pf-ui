import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadCsv, toCsv } from './csv.utils';

describe('csv.utils', () => {
  describe('toCsv', () => {
    it('joins fields with commas and rows with CRLF', () => {
      const result = toCsv([
        ['Category', 'Total'],
        ['Rent', '900.00'],
      ]);

      expect(result).toBe('Category,Total\r\nRent,900.00');
    });

    it('leaves plain alphanumeric fields unquoted', () => {
      expect(toCsv([['Groceries']])).toBe('Groceries');
    });

    it('quotes a field containing a comma', () => {
      expect(toCsv([['Food, Dining']])).toBe('"Food, Dining"');
    });

    it('quotes a field containing a double quote and doubles the embedded quote', () => {
      expect(toCsv([['Say "Hi"']])).toBe('"Say ""Hi"""');
    });

    it('quotes a field containing a newline', () => {
      expect(toCsv([['Line1\nLine2']])).toBe('"Line1\nLine2"');
    });

    it('handles an empty array as an empty string', () => {
      expect(toCsv([])).toBe('');
    });
  });

  describe('downloadCsv', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates a Blob URL, triggers a click on a download anchor, and revokes the URL', () => {
      const mockUrl = 'blob:mock-url';
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      downloadCsv('report.csv', 'a,b\r\n1,2');

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });

    it('sets the download filename on the anchor that gets clicked', () => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      let capturedFilename = '';
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ): void {
        capturedFilename = this.download;
      });

      downloadCsv('category-report_2026-06-01_to_2026-09-01.csv', 'x');

      expect(capturedFilename).toBe('category-report_2026-06-01_to_2026-09-01.csv');
    });
  });
});
