/**
 * Escapes a single CSV field per RFC 4180: wraps it in double quotes if it contains a comma,
 * double quote, or newline, doubling any embedded double quotes.
 */
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Converts a 2D array of string cells (by convention, the first row is the header) into a
 * single RFC 4180-compliant CSV string.
 *
 * @param rows the cell values, one array per row
 */
export function toCsv(rows: string[][]): string {
  return rows.map((row: string[]): string => row.map(escapeCsvField).join(',')).join('\r\n');
}

const UTF8_BOM = String.fromCharCode(0xfeff);

/**
 * Triggers a browser download of the given CSV content under the given filename.
 *
 * Prepends a UTF-8 BOM -- without it, Excel doesn't reliably auto-detect the encoding and can
 * mangle any non-ASCII character (e.g. an accented category name) on open.
 *
 * @param filename the name the downloaded file should have, including the .csv extension
 * @param csvContent the CSV content, as produced by `toCsv`
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([UTF8_BOM, csvContent], { type: 'text/csv;charset=utf-8;' });
  const url: string = URL.createObjectURL(blob);

  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
