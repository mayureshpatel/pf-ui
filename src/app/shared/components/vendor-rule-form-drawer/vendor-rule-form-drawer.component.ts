import { Component, EventEmitter, inject, input, OnChanges, Output, signal, WritableSignal, SimpleChanges, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { VendorRuleDto } from '@models/vendor-rule.model';
import { VendorRuleApiService } from '@features/settings/vendor-rules/services/vendor-rule-api.service';
import { ToastService } from '@core/services/toast.service';
import { DrawerComponent } from '@shared/components/drawer/drawer.component';

@Component({
  selector: 'app-vendor-rule-form-drawer',
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    MessageModule,
    DrawerComponent
  ],
  templateUrl: './vendor-rule-form-drawer.component.html'
})
export class VendorRuleFormDrawerComponent implements OnChanges {
  private readonly api = inject(VendorRuleApiService);
  private readonly toast = inject(ToastService);

  visible = model.required<boolean>();
  initialKeyword = input<string>('');
  
  @Output() save = new EventEmitter<void>();

  formData: VendorRuleDto = {
    keyword: '',
    vendorName: '',
    priority: 0
  };

  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible() && this.initialKeyword()) {
      this.formData.keyword = this.initialKeyword();
      // Reset other fields if needed, or keep them if we want to retain previous edits (usually reset is safer)
      this.formData.vendorName = '';
      this.formData.priority = 0;
    } else if (changes['visible'] && !this.visible()) {
      // Optional: reset when closing
      this.resetForm();
    }
  }

  onHide(): void {
    setTimeout(() => {
      this.resetForm();
    }, 300);
  }

  onSubmit(): void {
    if (!this.formData.keyword || !this.formData.vendorName) {
      this.errorMessage.set('Keyword and Replacement Name are required');
      return;
    }

    this.loading.set(true);
    this.api.createRule(this.formData).subscribe({
      next: () => {
        this.toast.success('Rule created successfully');
        this.save.emit();
        this.onHide();
      },
      error: (error) => {
        this.errorMessage.set(error.error?.detail || 'Failed to create rule');
        this.loading.set(false);
      }
    });
  }

  resetForm(): void {
    this.formData = { keyword: '', vendorName: '', priority: 0 };
    this.errorMessage.set(null);
    this.loading.set(false);
  }
}
