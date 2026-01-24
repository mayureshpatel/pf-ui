import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

export interface AffectedTransaction {
  id: number;
  description: string;
  oldVendor: string | null;
  newVendor: string;
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
  // Inputs
  visible = input.required<boolean>();
  affectedTransactions = input.required<AffectedTransaction[]>();
  totalCount = input.required<number>();
  loading = input<boolean>(false);

  // Outputs
  visibleChange = output<boolean>();
  confirm = output<void>();

  get isLargeUpdate(): boolean {
    return this.totalCount() > 100;
  }

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  onConfirm(): void {
    this.confirm.emit();
  }
}
