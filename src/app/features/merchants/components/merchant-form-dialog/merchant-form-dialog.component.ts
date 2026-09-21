import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import { Merchant, MerchantCreateRequest, MerchantUpdateRequest } from '@models/merchant.model';
import { MerchantApiService } from '../../services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { RestoreFocusOnHideDirective } from '@shared/directives/restore-focus-on-hide.directive';

/**
 * Dialog for creating a merchant or editing an existing one's name and location. A `merchant`
 * input of `null` means create mode. 5 fields (name + 4 location) still fits a dialog under
 * PF-EPIC-037's own modal-pattern rule (7+ fields -> drawer, 6 or fewer -> dialog).
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
    MessageModule,
    RestoreFocusOnHideDirective,
  ],
  templateUrl: './merchant-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantFormDialogComponent {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for the dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The merchant being edited, or `null` for create mode. */
  readonly merchant: InputSignal<Merchant | null> = input.required<Merchant | null>();

  /** Emitted once the create/edit has saved successfully. */
  readonly save: OutputEmitterRef<void> = output<void>();

  /** Indicates if a save operation is in progress. */
  readonly saving: WritableSignal<boolean> = signal(false);

  /** Holds API error messages for display. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /** `true` when creating a new merchant (no target merchant given). */
  readonly isCreateMode: Signal<boolean> = computed((): boolean => this.merchant() === null);

  readonly dialogHeader: Signal<string> = computed((): string =>
    this.isCreateMode() ? 'Add Merchant' : 'Edit Merchant',
  );

  /**
   * Reactive form for the merchant's name and location.
   */
  readonly form = new FormGroup({
    name: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    city: new FormControl<string>('', { nonNullable: true }),
    state: new FormControl<string>('', { nonNullable: true }),
    postalCode: new FormControl<string>('', { nonNullable: true }),
    country: new FormControl<string>('', { nonNullable: true }),
  });

  constructor() {
    /**
     * Resets and pre-fills the form whenever the dialog opens for a (possibly different, possibly
     * absent) merchant.
     */
    effect((): void => {
      if (this.visible()) {
        const target: Merchant | null = this.merchant();
        this.form.reset({
          name: target?.name ?? '',
          city: target?.city ?? '',
          state: target?.state ?? '',
          postalCode: target?.postalCode ?? '',
          country: target?.country ?? '',
        });
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
   * Validates and submits the create or edit to the API.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const location = {
      city: blankToUndefined(raw.city),
      state: blankToUndefined(raw.state),
      postalCode: blankToUndefined(raw.postalCode),
      country: blankToUndefined(raw.country),
    };

    const target: Merchant | null = this.merchant();
    const request$ = target
      ? this.merchantApi.updateMerchant({
          id: target.id,
          userId: target.userId,
          name: raw.name,
          ...location,
        } satisfies MerchantUpdateRequest)
      : this.merchantApi.createMerchant({
          userId: 0, // overwritten server-side from the authenticated caller; see MerchantApiService.createMerchant
          name: raw.name,
          ...location,
        } satisfies MerchantCreateRequest);

    request$.pipe(finalize((): void => this.saving.set(false))).subscribe({
      next: (): void => {
        this.toast.success(this.isCreateMode() ? 'Merchant created' : 'Merchant updated');
        this.save.emit();
        this.onHide();
      },
      error: (err: any): void => {
        console.error('Error saving merchant:', err);
        this.errorMessage.set(err.error?.detail || 'Failed to save merchant. Please try again.');
      },
    });
  }
}

/** Empty/whitespace-only input becomes `undefined` so an unset optional field is omitted from
 *  the request body, rather than sent as a literal empty string. */
function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
