import {
  Component,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DrawerModule} from 'primeng/drawer';
import {ButtonModule} from 'primeng/button';

@Component({
  selector: 'app-drawer',
  imports: [CommonModule, DrawerModule, ButtonModule],
  templateUrl: './drawer.component.html'
})
export class DrawerComponent {
  visible: ModelSignal<boolean> = model.required<boolean>();
  title: InputSignal<string> = input.required<string>();
  icon: InputSignal<string | null> = input<string | null>(null);
  saveLabel: InputSignal<string> = input<string>('Save');
  cancelLabel: InputSignal<string> = input<string>('Cancel');

  width: InputSignal<string> = input<string>('w-full md:w-[500px]');

  saving: WritableSignal<boolean> = signal<boolean>(false);
  valid: WritableSignal<boolean> = signal<boolean>(true);

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
