import { vi } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionSidePanelComponent } from './transaction-side-panel.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TransactionSidePanelComponent],
  template: `
    <app-transaction-side-panel
      [title]="title()"
      [saving]="saving()"
      [valid]="valid()"
      [showDelete]="showDelete()"
      (save)="saved()"
      (closePanel)="closed()"
      (delete)="deleted()"
    >
      <p data-testid="body">body</p>
    </app-transaction-side-panel>
  `,
})
class HostComponent {
  title = signal('Edit transaction');
  saving = signal(false);
  valid = signal(true);
  showDelete = signal(true);
  saved = vi.fn();
  closed = vi.fn();
  deleted = vi.fn();
}

describe('TransactionSidePanelComponent', () => {
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

  it('should close on Escape', () => {
    // act
    q('aside').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    // assert & verify
    expect(host.closed).toHaveBeenCalledTimes(1);
  });
});
