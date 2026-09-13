import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';

// Mirrors PrimeNG's own Dialog focusOnShow behavior, which p-drawer has no equivalent for.
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Drawer component for displaying forms.
 *
 * This component is a wrapper around the DrawerModule from PrimeNG.
 * It provides a consistent look and feel for form drawers and can be used to display forms in a modal dialog.
 */
@Component({
  selector: 'app-drawer',
  imports: [CommonModule, DrawerModule, ButtonModule],
  templateUrl: './drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrawerComponent {
  /**
   * Indicates whether the drawer is currently visible.
   */
  visible: ModelSignal<boolean> = model.required<boolean>();

  /**
   * Title of the drawer.
   */
  title: InputSignal<string> = input.required<string>();

  /**
   * Icon to display in the drawer header.
   *
   * Optional - if not provided, no icon will be displayed.
   */
  icon: InputSignal<string | null> = input<string | null>(null);

  /**
   * Label for the save button.
   *
   * Default: 'Save'
   */
  saveLabel: InputSignal<string> = input<string>('Save');

  /**
   * Label for the cancel button.
   *
   * Default: 'Cancel'
   */
  cancelLabel: InputSignal<string> = input<string>('Cancel');

  /**
   * Width of the drawer.
   *
   * Default: 'w-full md:w-[500px]'
   */
  width: InputSignal<string> = input<string>('w-full md:w-[500px]');

  /**
   * Indicates whether the drawer is currently saving.
   */
  saving: InputSignal<boolean> = input<boolean>(false);

  /**
   * Indicates whether the form in the drawer is valid.
   */
  valid: InputSignal<boolean> = input<boolean>(true);

  /**
   * Save event emitter.
   */
  saveEmitterRef: OutputEmitterRef<void> = output<void>();

  /**
   * Cancel event emitter.
   */
  cancelEmitterRef: OutputEmitterRef<void> = output<void>();

  /**
   * Show event emitter.
   */
  showEmitterRef: OutputEmitterRef<void> = output<void>();

  private readonly focusScope: Signal<ElementRef<HTMLElement> | undefined> =
    viewChild('focusScope');

  private triggerElement: HTMLElement | null = null;

  constructor() {
    // Captured as early as possible -- before p-drawer's own open transition runs -- so it's
    // reliably the element the user actually triggered the drawer from, not whatever p-drawer's
    // own overlay/mask machinery may have focused by the time (onShow) fires.
    effect((): void => {
      if (this.visible()) {
        this.triggerElement = document.activeElement as HTMLElement;
      }
    });
  }

  /**
   * Emits the save event when the form is valid and not already saving.
   */
  onSave(): void {
    if (!this.saving() && this.valid()) {
      this.saveEmitterRef.emit();
    }
  }

  /**
   * Closes the drawer and emits the cancel event.
   */
  onCancel(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.visible.set(false);
  }

  /**
   * Moves focus into the drawer once it's fully shown, unless something inside it (e.g. an
   * `[autofocus]` field) already claimed focus first.
   */
  onShow(): void {
    this.showEmitterRef.emit();
    setTimeout((): void => this.focusIntoDrawerIfUnclaimed(), 50);
  }

  /**
   * Restores focus to whatever triggered the drawer's opening.
   */
  onHide(): void {
    this.cancelEmitterRef.emit();
    this.triggerElement?.focus?.();
    this.triggerElement = null;
  }

  private focusIntoDrawerIfUnclaimed(): void {
    const container: HTMLElement | undefined = this.focusScope()?.nativeElement;
    if (!container || !container.isConnected || container.contains(document.activeElement)) {
      return;
    }
    // PrimeNG's own [autofocus]/pAutoFocus (e.g. transaction-form-drawer's amount field) sets the
    // real `autofocus` DOM attribute synchronously, but defers its actual .focus() call via its
    // own setTimeout -- under this app's zoneless change detection that call can land later than
    // this one, so prefer an explicit autofocus target here rather than racing on timing.
    const target: HTMLElement | null =
      container.querySelector<HTMLElement>('[autofocus]') ??
      container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();
  }
}
