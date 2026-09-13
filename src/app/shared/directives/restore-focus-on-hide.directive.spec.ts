import { ChangeDetectionStrategy, Component, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Dialog } from 'primeng/dialog';
import { RestoreFocusOnHideDirective } from './restore-focus-on-hide.directive';

@Component({
  imports: [Dialog, RestoreFocusOnHideDirective],
  template: `
    <button id="trigger" (click)="visible.set(true)">Open</button>
    <p-dialog [(visible)]="visible" appRestoreFocusOnHide header="Test Dialog">
      <input id="inside-field" />
    </p-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  visible: WritableSignal<boolean> = signal(false);
}

describe('RestoreFocusOnHideDirective', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('restores focus to the trigger element once the dialog reports onHide', () => {
    // arrange
    const trigger = fixture.debugElement.query(By.css('#trigger'))
      .nativeElement as HTMLButtonElement;
    trigger.focus();

    // act -- open (the directive must capture `trigger` here, via ngDoCheck)
    trigger.click();
    fixture.detectChanges();

    // simulate what p-dialog's own focusOnShow does in the real app: move focus into the dialog.
    // Asserting this first is what makes the final assertion meaningful -- without it, a broken
    // capture (never actually storing `trigger`) would pass trivially, since focus never left.
    const insideField = fixture.debugElement.query(By.css('#inside-field'))
      .nativeElement as HTMLInputElement;
    insideField.focus();
    expect(document.activeElement).toBe(insideField);

    // act -- simulate the dialog's close animation completing (which is what actually fires
    // onHide), rather than waiting on a real CSS transition to finish. Confirming PrimeNG itself
    // fires onHide at the right time is this ticket's own live-keyboard-navigation AC, not
    // something a unit test of this directive's own reaction logic needs to re-prove.
    const dialog = fixture.debugElement.query(By.directive(Dialog)).injector.get(Dialog);
    dialog.onHide.emit({});

    // assert
    expect(document.activeElement).toBe(trigger);
  });

  it('does not throw when the dialog closes without ever having been shown', () => {
    // act & assert -- no captured trigger element yet
    expect(() => {
      fixture.componentInstance.visible.set(false);
      fixture.detectChanges();
    }).not.toThrow();
  });
});
