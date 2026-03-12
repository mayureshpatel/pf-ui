import {
  Component,
  computed,
  effect,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  output, OutputEmitterRef, Signal,
  signal, WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {toSignal} from '@angular/core/rxjs-interop';
import {ButtonModule} from 'primeng/button';
import {InputNumberModule} from 'primeng/inputnumber';
import {MessageModule} from 'primeng/message';
import {Account, AccountReconcileRequest} from '@models/account.model';
import {AccountApiService} from '@features/accounts/services/account-api.service';
import {ToastService} from '@core/services/toast.service';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';

/**
 * Component for reconciling an account balance.
 */
@Component({
  selector: 'app-reconcile-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputNumberModule,
    MessageModule,
    DrawerComponent
  ],
  templateUrl: './reconcile-dialog.component.html'
})
export class ReconcileDrawerComponent {
  private readonly accountService: AccountApiService = inject(AccountApiService);
  private readonly toast: ToastService = inject(ToastService);

  /**
   * Two-way binding for the drawer visibility.
   */
  visible: ModelSignal<boolean> = model<boolean>(false);

  /**
   * The account being reconciled.
   */
  account: InputSignal<Account> = input.required<Account>();

  /**
   * Emitted when the reconciliation process completes successfully.
   */
  reconciled: OutputEmitterRef<void> = output<void>();

  /**
   * Indicates if the reconciliation request is currently in progress.
   */
  saving: WritableSignal<boolean> = signal(false);

  /**
   * Holds any error message returned from the API.
   */
  errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Reactive form for capturing the target balance.
   */
  form = new FormGroup({
    targetBalance: new FormControl<number | null>(null, {
      validators: [Validators.required]
    })
  });

  /**
   * Signal that tracks the current form value for reactive calculations.
   */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue()
  });

  /**
   * Reactively calculates the difference between the target balance and the current system balance.
   */
  difference: Signal<number> = computed(() => {
    const target: number | null | undefined = this.formValue().targetBalance;
    if (target === null || target === undefined) return 0;
    return target - this.account().currentBalance;
  });

  constructor() {
    /**
     * Effect to handle cleanup and state resetting when the drawer is closed.
     */
    effect((): void => {
      if (!this.visible()) {
        this.form.reset();
        this.errorMessage.set(null);
      }
    });
  }

  /**
   * Submits the reconciliation request to the API.
   */
  submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const target: number = this.form.value.targetBalance!;
    this.saving.set(true);
    this.errorMessage.set(null);

    const request: AccountReconcileRequest = {
      id: this.account().id,
      newBalance: target,
      version: this.account().version
    };

    this.accountService.reconcile(request).subscribe({
      next: (): void => {
        this.toast.success('Account reconciled successfully');
        this.reconciled.emit();
        this.visible.set(false);
        this.saving.set(false);
      },
      error: (error: any): void => {
        console.error('Error reconciling account:', error);
        this.errorMessage.set(error.error?.detail || 'Failed to reconcile account');
        this.saving.set(false);
      }
    });
  }

  /**
   * Closes the drawer.
   */
  onCancel(): void {
    this.visible.set(false);
  }

  protected readonly Math = Math;
}
