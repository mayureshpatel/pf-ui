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
      expect(q('aside').className).toContain('rounded-2xl');
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
});
