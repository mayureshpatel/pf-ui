import { Component, EventEmitter, inject, input, Output, signal, WritableSignal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { Account } from '@models/account.model';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-reconcile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputNumberModule,
    MessageModule
  ],
  templateUrl: './reconcile-dialog.component.html'
})
export class ReconcileDialogComponent {
  visible = input.required<boolean>();
  account = input.required<Account>();

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() reconciled = new EventEmitter<void>();

  private readonly accountService = inject(AccountApiService);
  private readonly toast = inject(ToastService);

  targetBalance: WritableSignal<number | null> = signal(null);
  saving: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  protected readonly Math = Math;

  difference = computed(() => {
    const target = this.targetBalance();
    if (target === null) return 0;
    return target - this.account().currentBalance;
  });

  onHide(): void {
    this.visibleChange.emit(false);
    this.targetBalance.set(null);
    this.errorMessage.set(null);
  }

  submit(): void {
    const target = this.targetBalance();
    if (target === null) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    this.accountService.reconcile(this.account().id, target).subscribe({
      next: () => {
        this.toast.success('Account reconciled successfully');
        this.reconciled.emit();
        this.onHide();
        this.saving.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Failed to reconcile account');
        this.saving.set(false);
      }
    });
  }
}
