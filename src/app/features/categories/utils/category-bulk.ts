/** The batch limits, matching the backend. */
export const BULK_MAX_GROUPS = 50;
export const BULK_MAX_NAMES = 300;
export const BULK_MAX_NAME_LENGTH = 50;

/** Splits one-name-per-line text into trimmed names, dropping blank lines. */
export function parseNames(text: string | null | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/)
    .map((line: string): string => line.trim())
    .filter((line: string): boolean => line !== '');
}

/** Names longer than the limit, shortened for display so a pasted paragraph stays readable. */
export function overLongNames(names: string[], max: number = BULK_MAX_NAME_LENGTH): string[] {
  return names.filter((name: string): boolean => name.length > max);
}

/** Shortens a value for a message. */
export function preview(value: string, max = 30): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

/** "1 category" / "3 categories". */
export function categoryCount(count: number): string {
  return `${count} ${count === 1 ? 'category' : 'categories'}`;
}
