import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

export interface RuleChangePreview {
  description: string;
  oldValue: string | null;
  newValue: string;
}

@Component({
  selector: 'app-apply-rules-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    TableModule
  ],
  templateUrl: './apply-rules-dialog.component.html'
})
export class ApplyRulesDialogComponent {
  visible = input.required<boolean>();
  previewItems = input.required<RuleChangePreview[]>();
  fieldLabel = input<string>('Value');
  loading = input<boolean>(false);

  visibleChange = output<boolean>();
  confirm = output<void>();

  get totalCount(): number {
    return this.previewItems().length;
  }

  get isLargeUpdate(): boolean {
    return this.totalCount > 100;
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  onConfirm(): void {
    this.confirm.emit();
  }
}
