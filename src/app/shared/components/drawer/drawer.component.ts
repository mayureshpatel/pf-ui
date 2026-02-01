import { Component, input, output, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-drawer',
  imports: [CommonModule, DrawerModule, ButtonModule],
  templateUrl: './drawer.component.html'
})
export class DrawerComponent {
  visible = model.required<boolean>();
  title = input.required<string>();
  icon = input<string | null>(null);
  saving = input<boolean>(false);
  valid = input<boolean>(true);
  saveLabel = input<string>('Save');
  cancelLabel = input<string>('Cancel');
  
  // Customizing drawer width
  width = input<string>('w-full md:w-[500px]');

  save = output<void>();
  cancel = output<void>();

  onSave() {
    if (!this.saving() && this.valid()) {
      this.save.emit();
    }
  }

  onCancel(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.visible.set(false);
  }
}
