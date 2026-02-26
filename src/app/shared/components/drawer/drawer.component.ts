import {Component, input, InputSignal, model, ModelSignal, output, OutputEmitterRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DrawerModule} from 'primeng/drawer';
import {ButtonModule} from 'primeng/button';

@Component({
  selector: 'app-drawer',
  imports: [CommonModule, DrawerModule, ButtonModule],
  templateUrl: './drawer.component.html'
})
export class DrawerComponent {
  // input signals
  visible: ModelSignal<boolean> = model.required<boolean>();
  title: InputSignal<string> = input.required<string>();
  icon: InputSignal<string | null> = input<string | null>(null);
  saveLabel: InputSignal<string> = input<string>('Save');
  cancelLabel: InputSignal<string> = input<string>('Cancel');
  width: InputSignal<string> = input<string>('w-full md:w-[500px]');
  saving: InputSignal<boolean> = input<boolean>(false);
  valid: InputSignal<boolean> = input<boolean>(true);

  // output signals
  saveEmitterRef: OutputEmitterRef<void> = output<void>();
  cancelEmitterRef: OutputEmitterRef<void> = output<void>();

  onSave(): void {
    if (!this.saving() && this.valid()) {
      this.saveEmitterRef.emit();
    }
  }

  onCancel(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.visible.set(false);
  }
}
