import {
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
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {finalize} from 'rxjs';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {RadioButtonModule} from 'primeng/radiobutton';
import {MessageModule} from 'primeng/message';

import {Merchant} from '@models/merchant.model';
import {MerchantApiService} from '../../services/merchant-api.service';
import {ToastService} from '@core/services/toast.service';

/**
 * Confirmation dialog for merging two merchant records (PF-222): the user picks which of the two
 * survives, everything else -- transactions, recurring transactions -- moves to it, and the other
 * is deleted. Deliberately requires an explicit choice (no default survivor) so a merge direction
 * is never picked by accident.
 */
@Component({
  selector: 'app-merge-merchants-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    RadioButtonModule,
    MessageModule
  ],
  templateUrl: './merge-merchants-dialog.component.html'
})
export class MergeMerchantsDialogComponent {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for the dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The two merchants being considered for a merge. */
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();

  /** Emitted once the merge has completed successfully. */
  readonly merged: OutputEmitterRef<void> = output<void>();

  /** Indicates if a merge operation is in progress. */
  readonly saving: WritableSignal<boolean> = signal(false);

  /** Holds API error messages for display. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /** The id of the merchant the user has chosen to keep. Null until an explicit choice is made. */
  readonly survivingMerchantId: WritableSignal<number | null> = signal(null);

  /** The merchant that will be merged away and deleted, once a choice has been made. */
  readonly mergedAwayMerchant: Signal<Merchant | null> = computed((): Merchant | null => {
    const survivorId: number | null = this.survivingMerchantId();
    return survivorId === null ? null : (this.merchants().find((m: Merchant): boolean => m.id !== survivorId) ?? null);
  });

  constructor() {
    /**
     * Resets the choice whenever the dialog opens for a (possibly different) pair of merchants.
     */
    effect((): void => {
      if (this.visible()) {
        this.survivingMerchantId.set(null);
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
   * Merges the two merchants in the chosen direction.
   */
  onSubmit(): void {
    const survivorId: number | null = this.survivingMerchantId();
    const mergedAway: Merchant | null = this.mergedAwayMerchant();
    if (survivorId === null || !mergedAway || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    this.merchantApi.mergeMerchants({survivingMerchantId: survivorId, mergedAwayMerchantId: mergedAway.id})
      .pipe(finalize((): void => this.saving.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success('Merchants merged');
          this.merged.emit();
          this.onHide();
        },
        error: (err: any): void => {
          console.error('Error merging merchants:', err);
          this.errorMessage.set(err.error?.detail || 'Failed to merge merchants. Please try again.');
        }
      });
  }
}
