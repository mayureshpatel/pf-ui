/** Routes that must never be a post-login destination. */
const AUTH_PAGES: readonly string[] = ['/login', '/register'];

/**
 * Validates a `returnUrl` so the post-login redirect can never leave the app (open redirect).
 *
 * Accepted: a relative in-app path starting with a single `/`. Rejected: anything else, including
 * protocol-relative (`//x`), backslash tricks (`/\x`), schemes (`https:`, `javascript:`), control
 * characters, and the login/register pages themselves.
 *
 * @param value - The raw candidate (typically a query-param value).
 * @returns The same string when safe, otherwise null.
 */
export function getSafeReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(value, 'http://pf.invalid');
  } catch {
    return null;
  }
  if (parsed.origin !== 'http://pf.invalid') {
    return null;
  }
  const path: string = parsed.pathname.toLowerCase().replace(/\/+$/, '');
  return AUTH_PAGES.includes(path) ? null : value;
}
