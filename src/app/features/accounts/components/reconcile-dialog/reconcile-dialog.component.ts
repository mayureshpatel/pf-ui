import {
  Component,
  computed,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {Account} from '@models/account.model';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {ToastService} from '@core/services/toast.service';

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
  // injected services
  private readonly accountService = inject(AccountApiService);
  private readonly toast = inject(ToastService);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();
  account: InputSignal<Account> = input.required<Account>();

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  reconciled: OutputEmitterRef<void> = output<void>();

  // signals
  targetBalance: WritableSignal<number | null> = signal(null);
  saving: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  // computed signals
  difference = computed(() => {
    const target = this.targetBalance();
    if (target === null) return 0;
    return target - this.account().currentBalance;
  });

  // constants
  protected readonly Math = Math;

  /**
   * Handles the hiding of the dialog.
   * Clears the target balance and error message.
   */
  onHide(): void {
    this.visibleChange.emit(false);

    this.targetBalance.set(null);
    this.errorMessage.set(null);
  }

  /**
   * Submits the reconciliation request.
   */
  submit(): void {
    const target: number | null = this.targetBalance();

    if (target === null) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    this.accountService.reconcile(this.account().id, target).subscribe({
      next: (): void => {
        this.toast.success('Account reconciled successfully');
        this.reconciled.emit();

        this.onHide();
        this.saving.set(false);
      },
      error: (error: any): void => {
        console.error('Error reconciling account:', error);

        this.errorMessage.set(error.error?.detail || 'Failed to reconcile account');
        this.saving.set(false);
      }
    });
  }
}
