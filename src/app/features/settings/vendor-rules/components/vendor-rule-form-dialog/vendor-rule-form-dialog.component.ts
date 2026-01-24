import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { VendorRuleFormData } from '@models/vendor-rule.model';

@Component({
  selector: 'app-vendor-rule-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule
  ],
  templateUrl: './vendor-rule-form-dialog.component.html'
})
export class VendorRuleFormDialogComponent {
  // Inputs
  visible = input.required<boolean>();
  saving = input<boolean>(false);

  // Outputs
  visibleChange = output<boolean>();
  save = output<VendorRuleFormData>();

  // Form state
  keyword = signal<string>('');
  vendorName = signal<string>('');
  priority = signal<number>(0);

  constructor() {
    // Reset form when dialog visibility changes
    effect(() => {
      if (!this.visible()) {
        this.resetForm();
      }
    });
  }

  get isValid(): boolean {
    return this.keyword().trim().length > 0 && this.vendorName().trim().length > 0;
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  onSave(): void {
    if (!this.isValid) return;

    const data: VendorRuleFormData = {
      keyword: this.keyword().trim(),
      vendorName: this.vendorName().trim(),
      priority: this.priority() || 0
    };

    this.save.emit(data);
  }

  private resetForm(): void {
    this.keyword.set('');
    this.vendorName.set('');
    this.priority.set(0);
  }
}
