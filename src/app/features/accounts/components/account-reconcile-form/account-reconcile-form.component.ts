import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  OnInit,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { Account, AccountReconcileRequest } from '@models/account.model';
import { AccountApiService } from '@features/accounts/services/account-api.service';
import { ToastService } from '@core/services/toast.service';
import { FormatCurrencyPipe } from '@shared/pipes/format-currency.pipe';
import { toCents } from '../../utils/account-totals';

/**
 * The panel's reconcile step: the user types the balance on their statement and the app posts the
 * adjustment that makes its own balance match.
 */
@Component({
  selector: 'app-account-reconcile-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputNumberModule, MessageModule, FormatCurrencyPipe],
  templateUrl: './account-reconcile-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountReconcileFormComponent implements OnInit {
  private readonly accountService: AccountApiService = inject(AccountApiService);
  private readonly toast: ToastService = inject(ToastService);

  /** The account being reconciled. */
  account: InputSignal<Account> = input.required<Account>();

  /** Emitted after a successful reconcile, with the adjustment that was posted. */
  reconciled: OutputEmitterRef<{ adjustment: number }> = output<{ adjustment: number }>();

  /** Emitted when the host should reload the accounts (for example after a version conflict). */
  reloadRequested: OutputEmitterRef<void> = output<void>();

  /** Indicates if the reconciliation request is currently in progress. */
  saving: WritableSignal<boolean> = signal(false);

  /** Holds any error message returned from the API. */
  errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /** Reactive form for capturing the target balance. */
  form = new FormGroup({
    targetBalance: new FormControl<number | null>(null, {
      validators: [Validators.required],
    }),
  });

  /** Signal that tracks the current form value for reactive calculations. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** What would be posted: the typed statement balance minus the app's balance, in cents. */
  difference: Signal<number> = computed((): number => {
    const target: number | null | undefined = this.formValue().targetBalance;
    if (target === null || target === undefined) return 0;
    return toCents(target - this.account().currentBalance);
  });

  /** A balance was typed and it already matches. */
  balanced: Signal<boolean> = computed((): boolean => {
    const target: number | null | undefined = this.formValue().targetBalance;
    return target !== null && target !== undefined && this.difference() === 0;
  });

  /** Which account is shown; the form resets only when this changes, not on a background refresh. */
  private readonly accountId: Signal<number> = computed((): number => this.account().id);

  /** The key the form was last filled for; the effect only resets when it really changes. */
  private filledFor: string | null = null;

  constructor() {
    effect((): void => {
      const key = String(this.accountId());
      // the reset at init already covered this account; only a different one resets again
      if (key === this.filledFor) return;
      untracked((): void => this.fill(key));
    });
  }

  /**
   * Starts the form empty at init, synchronously and before the first render, so a balance typed
   * at once can never be cleared by an effect that runs a moment later.
   */
  ngOnInit(): void {
    const key = String(this.accountId());
    if (key !== this.filledFor) this.fill(key);
  }

  private fill(key: string): void {
    this.filledFor = key;
    this.form.reset();
    this.errorMessage.set(null);
  }

  /**
   * Submits on Enter. Was previously bound to every keydown, which submitted the field's
   * partial value after the very first digit typed.
   */
  onBalanceKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.submit();
    }
  }

  /** Posts the reconciliation unless the form is incomplete, already balanced, or saving. */
  submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.balanced()) return;

    const target: number = this.form.value.targetBalance!;
    const adjustment: number = this.difference();
    this.saving.set(true);
    this.errorMessage.set(null);

    const request: AccountReconcileRequest = {
      accountId: this.account().id,
      newBalance: target,
      version: this.account().version,
    };

    this.accountService.reconcile(request).subscribe({
      next: (): void => {
        this.toast.success('Account reconciled successfully');
        this.form.markAsPristine();
        this.reconciled.emit({ adjustment });
        this.saving.set(false);
      },
      error: (error: HttpErrorResponse): void => {
        console.error('Error reconciling account:', error);
        this.errorMessage.set(error.error?.detail || 'Failed to reconcile account');
        this.reloadRequested.emit();
        this.saving.set(false);
      },
    });
  }
}
