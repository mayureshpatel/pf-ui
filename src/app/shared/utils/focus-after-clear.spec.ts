import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusAfterClear } from './focus-after-clear';

describe('focusAfterClear', () => {
  let root: HTMLElement;

  const mount = (coarse: boolean): void => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: coarse } as MediaQueryList);
    root = document.createElement('div');
    root.innerHTML = '<input type="search"><section tabindex="-1" data-focus-results></section>';
    document.body.appendChild(root);
  };

  afterEach(() => {
    root.remove();
    vi.restoreAllMocks();
  });

  it('should focus the search box with a fine pointer', () => {
    // arrange
    mount(false);

    // act
    focusAfterClear(root);

    // assert & verify
    expect(document.activeElement).toBe(root.querySelector('input'));
  });

  it('should focus the results region on a touch device, so no keyboard opens unasked', () => {
    // arrange
    mount(true);

    // act
    focusAfterClear(root);

    // assert & verify
    expect(document.activeElement).toBe(root.querySelector('[data-focus-results]'));
  });
});
