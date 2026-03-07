import {Component, input, InputSignal, model, ModelSignal, output, OutputEmitterRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DrawerModule} from 'primeng/drawer';
import {ButtonModule} from 'primeng/button';

/**
 * Drawer component for displaying forms.
 *
 * This component is a wrapper around the DrawerModule from PrimeNG.
 * It provides a consistent look and feel for form drawers and can be used to display forms in a modal dialog.
 */
@Component({
  selector: 'app-drawer',
  imports: [CommonModule, DrawerModule, ButtonModule],
  templateUrl: './drawer.component.html'
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
}
