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
import { AuthService } from '@core/auth/auth.service';
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
  private readonly authService: AuthService = inject(AuthService);

  /** Two-way binding for the dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The merchant being edited, or `null` for create mode. */
  readonly merchant: InputSignal<Merchant | null> = input.required<Merchant | null>();

  /** In create mode only (`merchant` is `null`), pre-fills the name field with this value --
   *  e.g. from an inline "+ Create" affordance elsewhere in the app. Ignored in edit mode. */
  readonly initialName: InputSignal<string | null> = input<string | null>(null);

  /** Emitted with the saved merchant once the create/edit has saved successfully. */
  readonly save: OutputEmitterRef<Merchant> = output<Merchant>();

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
          name: target?.name ?? this.initialName() ?? '',
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
    const city = blankToUndefined(raw.city);
    const state = blankToUndefined(raw.state);
    const postalCode = blankToUndefined(raw.postalCode);
    const country = blankToUndefined(raw.country);
    const userId: number = this.authService.user()?.id ?? 0;

    const target: Merchant | null = this.merchant();
    const request$ = target
      ? this.merchantApi.updateMerchant({
          id: target.id,
          userId,
          name: raw.name,
          city,
          state,
          postalCode,
          country,
        } satisfies MerchantUpdateRequest)
      : this.merchantApi.createMerchant({
          userId,
          name: raw.name,
          city,
          state,
          postalCode,
          country,
        } satisfies MerchantCreateRequest);

    request$.pipe(finalize((): void => this.saving.set(false))).subscribe({
      // `result` is the new id in create mode, or the rows-affected count in edit mode -- only
      // the create-mode value is ever actually needed, since the edit-mode id is already known.
      next: (result: number): void => {
        const saved: Merchant = {
          id: target ? target.id : result,
          userId,
          name: raw.name,
          city: city ?? null,
          state: state ?? null,
          postalCode: postalCode ?? null,
          country: country ?? null,
        };
        this.toast.success(this.isCreateMode() ? 'Merchant created' : 'Merchant updated');
        this.save.emit(saved);
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
