import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  InputSignal,
  OnInit,
  output,
  OutputEmitterRef,
  Signal,
  untracked,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { Account } from '@models/account.model';
import { Merchant } from '@models/merchant.model';
import { RecurringFrequency, RecurringTransaction } from '@models/recurring.model';
import { fromLocalDateString, toLocalDateString } from '@shared/utils/transaction.utils';
import {
  FREQUENCY_LABELS,
  FREQUENCY_ORDER,
  priceChangeText,
  shortDate,
} from '../../utils/recurring-helpers';

/** What the form hands the host to save. `id` is set when editing; `nextDate` is yyyy-MM-dd. */
export interface RecurringFormValue {
  id?: number;
  merchantId: number;
  accountId: number;
  amount: number;
  frequency: RecurringFrequency;
  nextDate: string;
  active: boolean;
}

/**
 * The panel's item and add modes: one form for both, plus the last real charge, the price-change
 * note with Update price, Pause or Resume, and Delete (edit mode only). Save lives in the panel's
 * footer; the host calls {@link submit}.
 */
@Component({
  selector: 'app-recurring-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputNumberModule, SelectModule, DatePicker, CurrencyPipe],
  templateUrl: './recurring-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringEditFormComponent implements OnInit {
  /** The tracked item being edited (null when adding one). */
  readonly item: InputSignal<RecurringTransaction | null> = input<RecurringTransaction | null>(
    null,
  );
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();
  /** The merchants matching the search so far; the item's own merchant is always offered too. */
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();

  readonly save: OutputEmitterRef<RecurringFormValue> = output<RecurringFormValue>();
  readonly updatePrice: OutputEmitterRef<void> = output<void>();
  readonly togglePaused: OutputEmitterRef<void> = output<void>();
  readonly deleteItem: OutputEmitterRef<void> = output<void>();
  /** The text typed into the merchant search, for the host to narrow the list. */
  readonly merchantFilter: OutputEmitterRef<string> = output<string>();

  readonly frequencyOptions: { label: string; value: RecurringFrequency }[] = FREQUENCY_ORDER.map(
    (value: RecurringFrequency) => ({ label: FREQUENCY_LABELS[value], value }),
  );

  readonly form = new FormGroup({
    merchantId: new FormControl<number | null>(null, [Validators.required]),
    accountId: new FormControl<number | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(1_000_000),
    ]),
    frequency: new FormControl<RecurringFrequency | null>('MONTHLY', [Validators.required]),
    nextDate: new FormControl<Date | null>(null, [Validators.required]),
  });

  readonly isEditMode: Signal<boolean> = computed((): boolean => this.item() !== null);

  readonly merchantChoices: Signal<Merchant[]> = computed((): Merchant[] => {
    const own: Merchant | undefined = this.item()?.merchant;
    const list: Merchant[] = this.merchants();
    return own && !list.some((m: Merchant): boolean => m.id === own.id) ? [...list, own] : list;
  });

  readonly lastCharge: Signal<{ date: string; amount: number } | null> = computed(() => {
    const item: RecurringTransaction | null = this.item();
    return item?.lastChargeDate && item.lastChargeAmount != null
      ? { date: shortDate(item.lastChargeDate), amount: item.lastChargeAmount }
      : null;
  });

  readonly priceNote: Signal<string | null> = computed((): string | null => {
    const change = this.item()?.priceChange;
    return change ? priceChangeText(change) : null;
  });

  /** The item id (or `'new'`) the form was last filled for; it only refills when this changes. */
  private filledFor: number | 'new' | null = null;

  constructor() {
    effect((): void => {
      const key: number | 'new' = this.item()?.id ?? 'new';
      if (key === this.filledFor) return;
      untracked((): void => this.fill(key));
    });
  }

  /** Fills the form before the first render so early typing is never wiped by a later effect. */
  ngOnInit(): void {
    const key: number | 'new' = this.item()?.id ?? 'new';
    if (key !== this.filledFor) this.fill(key);
  }

  private fill(key: number | 'new'): void {
    this.filledFor = key;
    const item: RecurringTransaction | null = this.item();
    this.form.reset({
      merchantId: item?.merchant?.id ?? null,
      accountId: item?.account?.id ?? null,
      amount: item?.amount ?? null,
      frequency: item?.frequency ?? 'MONTHLY',
      nextDate: item?.nextDate ? fromLocalDateString(item.nextDate) : null,
    });
  }

  onMerchantFilter(term: string): void {
    this.merchantFilter.emit(term);
  }

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const editing: RecurringTransaction | null = this.item();
    const value: RecurringFormValue = {
      merchantId: raw.merchantId as number,
      accountId: raw.accountId as number,
      amount: raw.amount as number,
      frequency: raw.frequency as RecurringFrequency,
      nextDate: toLocalDateString(raw.nextDate as Date),
      active: editing?.active ?? true,
    };
    this.save.emit(editing ? { id: editing.id, ...value } : value);
  }
}
