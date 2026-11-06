import { describe, expect, it } from 'vitest';
import { getSafeReturnUrl } from './return-url.utils';

describe('getSafeReturnUrl', () => {
  it.each([
    '/dashboard',
    '/transactions?page=2&q=a%20b',
    '/accounts/5#details',
    '/settings/profile',
    '/',
  ])('accepts the in-app path %s', (url) => {
    expect(getSafeReturnUrl(url)).toBe(url);
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['protocol-relative with path', '//evil.com/dashboard'],
    ['backslash after slash', '/\\evil.com'],
    ['embedded backslash', '/a\\b'],
    ['absolute https', 'https://evil.com'],
    ['absolute http', 'http://evil.com/dashboard'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,x'],
    ['relative without slash', 'dashboard'],
    ['empty', ''],
    ['leading space', ' /dashboard'],
    ['tab hidden slash', '/\t/evil.com'],
    ['newline', '/dash\nboard'],
    ['login page', '/login'],
    ['login with query', '/login?returnUrl=%2Fx'],
    ['register page', '/register'],
    ['login trailing slash', '/login/'],
    ['login different case', '/LOGIN'],
  ])('rejects %s', (_label, url) => {
    expect(getSafeReturnUrl(url)).toBeNull();
  });

  it.each([null, undefined, 42, {}, ['/dashboard']])('rejects the non-string %j', (value) => {
    expect(getSafeReturnUrl(value)).toBeNull();
  });
});
