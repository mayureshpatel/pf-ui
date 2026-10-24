import { vi } from 'vitest';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BudgetCopyDialogComponent } from './budget-copy-dialog.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BudgetCopyDialogComponent],
  template: `
    <app-budget-copy-dialog
      [(visible)]="visible"
      fromName="September"
      toName="October"
      [addCount]="addCount()"
      [overwriteCount]="overwriteCount()"
      (fill)="filled()"
      (replace)="replaced()"
    />
  `,
})
class HostComponent {
  visible = signal(true);
  addCount = signal(2);
  overwriteCount = signal(1);
  filled = vi.fn();
  replaced = vi.fn();
}

describe('BudgetCopyDialogComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('should name both months and say how many would be added and overwritten', () => {
    // assert & verify
    expect(document.body.textContent).toContain("Copy September's limits to October?");
    expect(document.body.textContent).toContain('2 new, 1 to overwrite.');
  });

  it('should emit fill and close from Fill gaps', () => {
    // act
    button('Fill gaps')?.click();
    fixture.detectChanges();

    // assert & verify
    expect(host.filled).toHaveBeenCalledTimes(1);
    expect(host.visible()).toBe(false);
  });

  it('should emit replace and close from Replace all', () => {
    // act
    button('Replace all')?.click();
    fixture.detectChanges();

    // assert & verify
    expect(host.replaced).toHaveBeenCalledTimes(1);
    expect(host.visible()).toBe(false);
  });

  it('should close without emitting from Cancel', () => {
    // act
    button('Cancel')?.click();
    fixture.detectChanges();

    // assert & verify
    expect(host.filled).not.toHaveBeenCalled();
    expect(host.replaced).not.toHaveBeenCalled();
    expect(host.visible()).toBe(false);
  });

  it('should disable Fill gaps with nothing to add and Replace all with nothing to change', () => {
    // act
    host.addCount.set(0);
    fixture.detectChanges();

    // assert & verify
    expect(button('Fill gaps')?.disabled).toBe(true);
    expect(button('Replace all')?.disabled).toBe(false);

    // act
    host.overwriteCount.set(0);
    fixture.detectChanges();

    // assert & verify
    expect(button('Replace all')?.disabled).toBe(true);
  });
});
