import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmationService, ConfirmEventType } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
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

describe('RestoreFocusOnHideDirective on a p-dialog header', () => {
  it('PF-945: gives the header close button an accessible name unless the dialog sets its own', async () => {
    @Component({
      imports: [Dialog, RestoreFocusOnHideDirective],
      template: `
        <p-dialog id="plain" [visible]="true" appRestoreFocusOnHide header="A" />
        <p-dialog
          id="named"
          [visible]="true"
          appRestoreFocusOnHide
          closeAriaLabel="Dismiss"
          header="B"
        />
      `,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class LabelHostComponent {}

    await TestBed.configureTestingModule({
      imports: [LabelHostComponent, NoopAnimationsModule],
    }).compileComponents();
    const labelFixture = TestBed.createComponent(LabelHostComponent);
    labelFixture.detectChanges();

    const dialogs: Dialog[] = labelFixture.debugElement
      .queryAll(By.directive(Dialog))
      .map((d) => d.injector.get(Dialog));
    expect(dialogs[0].closeAriaLabel).toBe('Close');
    expect(dialogs[1].closeAriaLabel).toBe('Dismiss');
  });
});

describe('RestoreFocusOnHideDirective on a p-confirmDialog', () => {
  @Component({
    imports: [ConfirmDialog, RestoreFocusOnHideDirective],
    template: `
      <button id="trigger" (click)="ask()">Delete</button>
      <p-confirmDialog appRestoreFocusOnHide />
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
  })
  class ConfirmHostComponent {
    private readonly confirmation: ConfirmationService = inject(ConfirmationService);
    ask(): void {
      this.confirmation.confirm({ message: 'Delete it?', header: 'Delete?' });
    }
  }

  let fixture: ComponentFixture<ConfirmHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmHostComponent, NoopAnimationsModule],
      providers: [ConfirmationService],
    }).compileComponents();
    fixture = TestBed.createComponent(ConfirmHostComponent);
    fixture.detectChanges();
  });

  it('PF-945: returns focus to the opener after the confirm closes, not to the page body', () => {
    const trigger = fixture.debugElement.query(By.css('#trigger'))
      .nativeElement as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();

    // PrimeNG moves focus into the dialog on show; here the body stands in for "lost".
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).not.toBe(trigger);

    const confirm = fixture.debugElement
      .query(By.directive(ConfirmDialog))
      .injector.get(ConfirmDialog);
    confirm.onHide.emit(ConfirmEventType.REJECT);

    expect(document.activeElement).toBe(trigger);
  });

  it('PF-945: names the confirm dialog close button', () => {
    const confirm = fixture.debugElement
      .query(By.directive(ConfirmDialog))
      .injector.get(ConfirmDialog);
    expect(confirm.closeAriaLabel).toBe('Close');
  });
});
