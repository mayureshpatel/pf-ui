import {Component, inject, input, InputSignal, output, OutputEmitterRef, signal, WritableSignal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
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
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputNumberModule,
    MessageModule
  ],
  templateUrl: './reconcile-dialog.component.html'
})
export class ReconcileDialogComponent {
  private readonly accountService = inject(AccountApiService);
  private readonly toast = inject(ToastService);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();
  account: InputSignal<Account> = input.required<Account>();

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  reconciled: OutputEmitterRef<void> = output<void>();

  // signals
  saving: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  form = new FormGroup({
    targetBalance: new FormControl<number | null>(null, { validators: [Validators.required] })
  });

  protected readonly Math = Math;

  get difference(): number {
    const target = this.form.value.targetBalance;
    if (target === null || target === undefined) return 0;
    return target - this.account().currentBalance;
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.form.reset();
    this.errorMessage.set(null);
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;

    const target = this.form.value.targetBalance!;
    this.saving.set(true);
    this.errorMessage.set(null);

    this.accountService.reconcile(this.account().id, target, this.account().version!).subscribe({
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
