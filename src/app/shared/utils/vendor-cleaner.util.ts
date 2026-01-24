import { VendorRule } from '@models/vendor-rule.model';

/**
 * Cleans vendor name from transaction description using vendor rules.
 * Mirrors backend VendorCleaner logic exactly.
 *
 * @param description Transaction description
 * @param rules List of vendor rules
 * @returns Cleaned vendor name or null if no match
 */
export function cleanVendorName(
  description: string | null,
  rules: VendorRule[]
): string | null {
  if (!description) return null;

  const descUpper = description.toUpperCase();

  // Sort by priority DESC, then keyword length DESC
  const sorted = [...rules].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.keyword.length - a.keyword.length;
  });

  // Return first match
  for (const rule of sorted) {
    if (descUpper.includes(rule.keyword.toUpperCase())) {
      return rule.vendorName;
    }
  }

  return null;
}
