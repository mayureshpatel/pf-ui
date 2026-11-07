import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  model,
  ModelSignal,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { Merchant } from '@models/merchant.model';
import {
  merchantOptions,
  NEW_MERCHANT_ID,
} from '@features/settings/merchant-rules/utils/merchant-options';

/**
 * A merchant field outside a form (PF-934): the ledger's "Both" mode needs a merchant choice next
 * to the category form, which already owns the shared keyword fields. It offers the user's
 * merchants and, when allowed, a "Create" option for a typed name no merchant has.
 */
@Component({
  selector: 'app-merchant-picker',
  standalone: true,
  imports: [FormsModule, SelectModule],
  templateUrl: './merchant-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantPickerComponent {
  /** Every merchant the user can choose. */
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();

  /** Whether a typed name may be created as a new merchant. */
  readonly allowCreate: InputSignal<boolean> = input<boolean>(false);

  /** An error to show under the field, or null. */
  readonly error: InputSignal<string | null> = input<string | null>(null);

  /** The chosen merchant; the "Create" option stands for a merchant that does not exist yet. */
  readonly value: ModelSignal<Merchant | null> = model<Merchant | null>(null);

  private readonly filterText: WritableSignal<string> = signal('');

  /** The merchants to choose from, plus the "Create" option for what has been typed. */
  readonly options: Signal<Merchant[]> = computed((): Merchant[] =>
    merchantOptions(this.merchants(), this.filterText(), this.allowCreate()),
  );

  /** Remembers what the user is searching the merchants for. */
  onFilter(event: { filter?: string | null }): void {
    this.filterText.set((event.filter ?? '').trim());
  }

  /** True for the "Create" option, which has no real merchant behind it yet. */
  protected isCreateOption(merchant: Merchant): boolean {
    return merchant.id === NEW_MERCHANT_ID;
  }
}
