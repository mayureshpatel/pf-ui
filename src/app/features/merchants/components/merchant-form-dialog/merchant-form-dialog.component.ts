import {
  Component,
  effect,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {MessageModule} from 'primeng/message';

import {Merchant} from '@models/merchant.model';
import {MerchantApiService} from '../../services/merchant-api.service';
import {ToastService} from '@core/services/toast.service';

/**
 * Dialog for correcting a merchant's display name (PF-220's endpoint). A single-field form --
 * per PF-EPIC-037's decided modal-pattern rule (7+ fields -> drawer, 6 or fewer -> dialog), this
 * is a dialog.
 */
@Component({
  selector: 'app-merchant-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    MessageModule
  ],
  templateUrl: './merchant-form-dialog.component.html'
})
export class MerchantFormDialogComponent {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for the dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The merchant being corrected. */
  readonly merchant: InputSignal<Merchant | null> = input.required<Merchant | null>();

  /** Emitted once the correction has saved successfully. */
  readonly save: OutputEmitterRef<void> = output<void>();

  /** Indicates if a save operation is in progress. */
  readonly saving: WritableSignal<boolean> = signal(false);

  /** Holds API error messages for display. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Reactive form for the merchant's corrected name.
   */
  readonly form = new FormGroup({
    cleanName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  });

  constructor() {
    /**
     * Resets and pre-fills the form whenever the dialog opens for a (possibly different) merchant.
     */
    effect((): void => {
      if (this.visible()) {
        this.form.reset({cleanName: this.merchant()?.cleanName ?? ''});
        this.errorMessage.set(null);
      }
    });
  }

  /**
   * Closes the dialog.
   */
  onHide(): void {
    this.visible.set(false);
  }

  /**
   * Validates and submits the correction to the API.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();

    const target: Merchant | null = this.merchant();
    if (this.form.invalid || this.saving() || !target) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    this.merchantApi.updateMerchant({id: target.id, cleanName: this.form.getRawValue().cleanName})
      .pipe(finalize((): void => this.saving.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success('Merchant name updated');
          this.save.emit();
          this.onHide();
        },
        error: (err: any): void => {
          console.error('Error updating merchant:', err);
          this.errorMessage.set(err.error?.detail || 'Failed to update merchant. Please try again.');
        }
      });
  }
}
