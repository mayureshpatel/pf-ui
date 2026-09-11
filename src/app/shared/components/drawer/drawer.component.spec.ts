import {vi} from 'vitest';
import {Component, signal, WritableSignal} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {DrawerComponent} from './drawer.component';

/**
 * Host component for exercising content projection and input bindings, since DrawerComponent's
 * own inputs (title, icon, saving, valid) can't vary per-test through a bare <app-drawer/> tag --
 * a host lets each test set fresh values without re-declaring the whole TestBed module.
 *
 * Bindings are signals, not plain fields: this app is zoneless, so a plain-field mutation has no
 * built-in change-notification path at all, and the app-drawer child (PrimeNG's p-drawer overlay
 * specifically) only picks up the new value reliably through a real signal write.
 */
@Component({
  imports: [DrawerComponent],
  template: `
    <app-drawer
      [(visible)]="visible"
      [title]="title()"
      [icon]="icon()"
      [saving]="saving()"
      [valid]="valid()"
      [saveLabel]="saveLabel()"
      [cancelLabel]="cancelLabel()"
      (saveEmitterRef)="onSave()"
      (cancelEmitterRef)="onCancel()"
      (showEmitterRef)="onShow()">
      <div id="projected-content">Projected form content</div>
    </app-drawer>
  `
})
class HostComponent {
  visible = signal(true);
  title = signal('Test Drawer');
  icon: WritableSignal<string | null> = signal(null);
  saving = signal(false);
  valid = signal(true);
  saveLabel = signal('Save');
  cancelLabel = signal('Cancel');

  onSave(): void {}

  onCancel(): void {}

  onShow(): void {}
}

describe('DrawerComponent', () => {
  let hostFixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, NoopAnimationsModule]
    }).compileComponents();

    hostFixture = TestBed.createComponent(HostComponent);
    host = hostFixture.componentInstance;
    hostFixture.detectChanges();
  });

  it('should render the title and projected content when visible', () => {
    // assert & verify
    expect(hostFixture.nativeElement.textContent).toContain('Test Drawer');
    const projected = hostFixture.debugElement.query(By.css('#projected-content'));
    expect(projected.nativeElement.textContent).toContain('Projected form content');
  });

  it('should not render an icon element when icon is null', () => {
    // assert & verify
    const drawer = hostFixture.debugElement.query(By.directive(DrawerComponent));
    expect(drawer.query(By.css('i.pi-plus'))).toBeNull();
  });

  it('should render the icon when provided', () => {
    // act
    host.icon.set('pi-plus');
    hostFixture.detectChanges();

    // assert & verify
    const drawer = hostFixture.debugElement.query(By.directive(DrawerComponent));
    expect(drawer.query(By.css('i.pi-plus'))).not.toBeNull();
  });

  it('should emit showEmitterRef when the drawer opens', () => {
    // arrange
    const onShowSpy = vi.spyOn(host, 'onShow');
    host.visible.set(false);
    hostFixture.detectChanges();

    // act
    host.visible.set(true);
    hostFixture.detectChanges();

    // assert & verify
    expect(onShowSpy).toHaveBeenCalled();
  });

  it('should emit cancelEmitterRef and close when Cancel is clicked', () => {
    // arrange
    const onCancelSpy = vi.spyOn(host, 'onCancel');
    const cancelButton = hostFixture.debugElement.query(By.css('button.p-button-secondary'));

    // act
    cancelButton.nativeElement.click();
    hostFixture.detectChanges();

    // assert & verify
    expect(host.visible()).toBe(false);
    expect(onCancelSpy).toHaveBeenCalled();
  });

  it('should emit saveEmitterRef when Save is clicked while valid and not saving', () => {
    // arrange
    const onSaveSpy = vi.spyOn(host, 'onSave');
    const saveButton = hostFixture.debugElement.query(By.css('button.p-button-primary'));

    // act
    saveButton.nativeElement.click();
    hostFixture.detectChanges();

    // assert & verify
    expect(onSaveSpy).toHaveBeenCalledTimes(1);
  });

  it('should not emit saveEmitterRef when invalid', () => {
    // arrange
    host.valid.set(false);
    hostFixture.detectChanges();
    const drawer = hostFixture.debugElement.query(By.directive(DrawerComponent)).componentInstance as DrawerComponent;
    const onSaveSpy = vi.spyOn(host, 'onSave');

    // act -- call the component method directly, since the real Save button is disabled and a
    // native click on a disabled button never dispatches in the first place
    drawer.onSave();

    // assert & verify
    expect(onSaveSpy).not.toHaveBeenCalled();
  });

  it('should not emit saveEmitterRef while saving', () => {
    // arrange
    host.saving.set(true);
    hostFixture.detectChanges();
    const drawer = hostFixture.debugElement.query(By.directive(DrawerComponent)).componentInstance as DrawerComponent;
    const onSaveSpy = vi.spyOn(host, 'onSave');

    // act
    drawer.onSave();

    // assert & verify
    expect(onSaveSpy).not.toHaveBeenCalled();
  });

  it('should disable the Save button while saving', () => {
    // act
    host.saving.set(true);
    hostFixture.detectChanges();

    // assert & verify
    const saveButton = hostFixture.debugElement.query(By.css('button.p-button-primary'));
    expect((saveButton.nativeElement as HTMLButtonElement).disabled).toBe(true);
  });

  it('should render custom save and cancel labels', () => {
    // act
    host.saveLabel.set('Create Widget');
    host.cancelLabel.set('Discard');
    hostFixture.detectChanges();

    // assert & verify
    expect(hostFixture.nativeElement.textContent).toContain('Create Widget');
    expect(hostFixture.nativeElement.textContent).toContain('Discard');
  });
});
