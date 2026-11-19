import { focusFirstInvalid } from './focus-first-invalid';

describe('focusFirstInvalid', (): void => {
  let root: HTMLElement;

  beforeEach((): void => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  afterEach((): void => root.remove());

  it('focuses the first invalid input and skips the form itself', (): void => {
    root.innerHTML = `<form class="ng-invalid"><input id="ok" /><input id="bad" class="ng-invalid" /></form>`;
    focusFirstInvalid(root);
    expect(document.activeElement?.id).toBe('bad');
  });

  it('focuses the combobox inside an invalid custom control', (): void => {
    root.innerHTML = `<form><span class="ng-invalid"><span id="box" role="combobox" tabindex="0"></span></span></form>`;
    focusFirstInvalid(root);
    expect(document.activeElement?.id).toBe('box');
  });

  it('does nothing when nothing is invalid', (): void => {
    root.innerHTML = `<form><input id="ok" /></form>`;
    focusFirstInvalid(root);
    expect(document.activeElement).toBe(document.body);
  });
});
