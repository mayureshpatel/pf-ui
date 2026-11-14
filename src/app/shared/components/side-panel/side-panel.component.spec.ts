import { vi } from 'vitest';
import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidePanelComponent } from './side-panel.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidePanelComponent],
  template: `
    <app-side-panel
      [title]="title()"
      [saving]="saving()"
      [valid]="valid()"
      [showDelete]="showDelete()"
      [showFooter]="showFooter()"
      [showClose]="showClose()"
      [sheet]="sheet()"
      (save)="saved()"
      (closePanel)="closed()"
      (delete)="deleted()"
    >
      <p data-testid="body">body</p>
    </app-side-panel>
  `,
})
class HostComponent {
  title = signal('Edit transaction');
  saving = signal(false);
  valid = signal(true);
  showDelete = signal(true);
  showFooter = signal(true);
  showClose = signal(true);
  sheet = signal(true);
  panel = viewChild(SidePanelComponent);
  saved = vi.fn();
  closed = vi.fn();
  deleted = vi.fn();
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidePanelComponent],
  template: `<app-side-panel title="No focus" [moveFocus]="false"><p>body</p></app-side-panel>`,
})
class NoFocusHostComponent {}

describe('SidePanelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const q = <T extends HTMLElement>(s: string): T => fixture.nativeElement.querySelector(s) as T;
  const button = (name: RegExp): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      name.test(b.textContent ?? ''),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be a labelled complementary region with the title as its heading and the projected body', () => {
    // assert & verify
    expect(q('aside').getAttribute('aria-label')).toBe('Edit transaction');
    expect(q('h2').textContent?.trim()).toBe('Edit transaction');
    expect(q('[data-testid="body"]').textContent).toBe('body');
  });

  it('should emit save, close and delete from their buttons', () => {
    // act
    button(/Save changes/)?.click();
    button(/Close/)?.click();
    button(/Delete/)?.click();

    // assert & verify
    expect(host.saved).toHaveBeenCalledTimes(1);
    expect(host.closed).toHaveBeenCalledTimes(1);
    expect(host.deleted).toHaveBeenCalledTimes(1);
  });

  it('should hide Delete when not offered and disable Save while invalid or saving', () => {
    // act
    host.showDelete.set(false);
    host.valid.set(false);
    fixture.detectChanges();

    // assert & verify
    expect(button(/Delete/)).toBeUndefined();
    expect(button(/Save changes/)?.disabled).toBe(true);
  });

  it('should hide the Save and Delete footer when showFooter is false', () => {
    // act
    host.showFooter.set(false);
    fixture.detectChanges();

    // assert & verify
    expect(button(/Save changes/)).toBeUndefined();
    expect(button(/Delete/)).toBeUndefined();
    expect(button(/Close/)).toBeTruthy();
  });

  it('should close on Escape', () => {
    // act
    q('aside').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    // assert & verify
    expect(host.closed).toHaveBeenCalledTimes(1);
  });

  describe('focus management', () => {
    it('should move focus into the panel when it opens and give it back when it closes', () => {
      // arrange -- a trigger outside the panel has focus, as when a row was just clicked
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      trigger.focus();
      const second = TestBed.createComponent(HostComponent);

      // act
      second.detectChanges();

      // assert & verify
      expect(second.nativeElement.querySelector('aside').contains(document.activeElement)).toBe(
        true,
      );

      // act
      second.destroy();

      // assert & verify
      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });
  });

  describe('nested widgets', () => {
    it('should not close when Escape was already handled by a widget inside the panel', () => {
      // arrange -- PrimeNG's autocomplete and date picker preventDefault their own Escape
      const body = q<HTMLElement>('[data-testid="body"]');
      body.addEventListener('keydown', (e: Event): void => e.preventDefault());

      // act
      body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );

      // assert & verify
      expect(host.closed).not.toHaveBeenCalled();
    });

    it('should give the Save button enough contrast for white text', () => {
      // assert & verify -- primary-500 is only about 2.5:1 with white; 700 is about 5.5:1
      expect(button(/Save changes/)?.className).toContain('bg-primary-700');
    });
  });

  describe('persistent-panel inputs', () => {
    it('should hide the Close button when showClose is false', () => {
      // act
      host.showClose.set(false);
      fixture.detectChanges();

      // assert & verify
      expect(button(/Close/)).toBeUndefined();
    });

    it('should be an in-flow block, not a fixed full-screen sheet, when sheet is false', () => {
      // assert & verify -- default is the sheet
      expect(q('aside').className).toContain('fixed');

      // act
      host.sheet.set(false);
      fixture.detectChanges();

      // assert & verify
      expect(q('aside').className).not.toContain('fixed');
      expect(q('aside').className).not.toContain('inset-0');
      expect(q('aside').className).toContain('rounded-xl');
    });

    it('should take focus after first render by default', async () => {
      // assert & verify
      await fixture.whenStable();
      expect(document.activeElement).toBe(q('aside'));
    });

    it('should not take focus after first render when moveFocus is false', async () => {
      // arrange
      (document.activeElement as HTMLElement | null)?.blur();

      // act
      const quiet = TestBed.createComponent(NoFocusHostComponent);
      quiet.detectChanges();
      await quiet.whenStable();

      // assert & verify
      expect(document.activeElement).not.toBe(quiet.nativeElement.querySelector('aside'));
    });

    it('should focus the aside when focus() is called', () => {
      // arrange
      (document.activeElement as HTMLElement | null)?.blur();

      // act
      host.panel()!.focus();

      // assert & verify
      expect(document.activeElement).toBe(q('aside'));
    });
  });

  describe('modal sheet (PF-944)', () => {
    const mockViewport = (wide: boolean): { change: (matches: boolean) => void } => {
      let listener: ((event: { matches: boolean }) => void) | undefined;
      vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: wide,
        addEventListener: (_: string, fn: (event: { matches: boolean }) => void): void => {
          listener = fn;
        },
        removeEventListener: (): void => undefined,
      } as unknown as MediaQueryList);
      return { change: (matches: boolean): void => listener?.({ matches }) };
    };

    const open = (): ComponentFixture<HostComponent> => {
      const opened = TestBed.createComponent(HostComponent);
      opened.detectChanges();
      return opened;
    };

    afterEach(() => vi.restoreAllMocks());

    it('should be a modal dialog and make the rest of the page inert below the lg breakpoint', () => {
      // arrange
      mockViewport(false);

      // act
      const narrow = open();
      const aside: HTMLElement = narrow.nativeElement.querySelector('aside');

      // assert & verify
      expect(aside.getAttribute('role')).toBe('dialog');
      expect(aside.getAttribute('aria-modal')).toBe('true');
      expect(aside.getAttribute('aria-label')).toBe('Edit transaction');
    });

    it('should mark the outside siblings inert and lift them when the panel closes', () => {
      // arrange
      mockViewport(false);
      const outside = document.createElement('div');
      document.body.appendChild(outside);
      const wrapper = document.createElement('section');
      const beside = document.createElement('button');
      wrapper.appendChild(beside);
      document.body.appendChild(wrapper);

      // act
      const narrow = TestBed.createComponent(HostComponent);
      wrapper.appendChild(narrow.nativeElement);
      narrow.detectChanges();

      // assert & verify
      expect(beside.hasAttribute('inert')).toBe(true);
      expect(outside.hasAttribute('inert')).toBe(false);

      // act
      narrow.destroy();

      // assert & verify
      expect(beside.hasAttribute('inert')).toBe(false);
      outside.remove();
      wrapper.remove();
    });

    it('should leave the global toast and confirm dialog reachable while the sheet is open', () => {
      // arrange
      mockViewport(false);
      const wrapper = document.createElement('section');
      const confirm = document.createElement('p-confirmdialog');
      const toast = document.createElement('p-toast');
      wrapper.append(confirm, toast);
      document.body.appendChild(wrapper);

      // act
      const narrow = TestBed.createComponent(HostComponent);
      wrapper.appendChild(narrow.nativeElement);
      narrow.detectChanges();

      // assert & verify
      expect(confirm.hasAttribute('inert')).toBe(false);
      expect(toast.hasAttribute('inert')).toBe(false);
      wrapper.remove();
    });

    it('should stay a docked complementary region with nothing inert from lg up', () => {
      // arrange
      mockViewport(true);
      const wrapper = document.createElement('section');
      const beside = document.createElement('button');
      wrapper.appendChild(beside);
      document.body.appendChild(wrapper);

      // act
      const wide = TestBed.createComponent(HostComponent);
      wrapper.appendChild(wide.nativeElement);
      wide.detectChanges();
      const aside: HTMLElement = wide.nativeElement.querySelector('aside');

      // assert & verify
      expect(aside.hasAttribute('role')).toBe(false);
      expect(aside.hasAttribute('aria-modal')).toBe(false);
      expect(beside.hasAttribute('inert')).toBe(false);
      wrapper.remove();
    });

    it('should release the page when the viewport widens', () => {
      // arrange
      const viewport = mockViewport(false);
      const wrapper = document.createElement('section');
      const beside = document.createElement('button');
      wrapper.appendChild(beside);
      document.body.appendChild(wrapper);
      const narrow = TestBed.createComponent(HostComponent);
      wrapper.appendChild(narrow.nativeElement);
      narrow.detectChanges();
      expect(beside.hasAttribute('inert')).toBe(true);

      // act
      viewport.change(true);
      narrow.detectChanges();

      // assert & verify
      expect(beside.hasAttribute('inert')).toBe(false);
      expect(narrow.nativeElement.querySelector('aside').hasAttribute('role')).toBe(false);
      wrapper.remove();
    });

    it('should give Close, Delete and Save a 44px minimum below lg, and Delete a dark border', () => {
      // arrange
      mockViewport(false);

      // act
      const narrow = open();
      const buttons = Array.from<HTMLButtonElement>(
        narrow.nativeElement.querySelectorAll('button'),
      );

      // assert & verify
      expect(buttons).toHaveLength(3);
      for (const control of buttons) {
        expect(control.className).toContain('max-lg:min-h-11');
      }
      expect(buttons[0].className).toContain('max-lg:min-w-11');
      expect(buttons[1].className).toContain('dark:border-rose-800');
    });
  });
});
