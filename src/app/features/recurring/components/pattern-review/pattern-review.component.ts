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
  signal,
  Signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePicker } from 'primeng/datepicker';
import { Account } from '@models/account.model';
import { Merchant } from '@models/merchant.model';
import { DismissedPattern, RecurringFrequency, RecurringSuggestion } from '@models/recurring.model';
import { fromLocalDateString, toLocalDateString } from '@shared/utils/transaction.utils';
import {
  confidenceLabel,
  FREQUENCY_LABELS,
  FREQUENCY_ORDER,
  shortDate,
} from '../../utils/recurring-helpers';

/** The pseudo merchant choice that means "make a new merchant from the detected text". */
export const CREATE_MERCHANT_ID = -1;

/** What the review form hands the host when the user accepts a pattern. */
export interface PatternAcceptance {
  pattern: RecurringSuggestion;
  /** The chosen existing merchant, or null when a new one should be created. */
  merchantId: number | null;
  /** The chosen existing merchant's name, or null when a new one should be created. */
  merchantName: string | null;
  /** The name for the merchant to create, or null when an existing one was chosen. */
  newMerchantName: string | null;
  accountId: number;
  amount: number;
  frequency: RecurringFrequency;
  /** yyyy-MM-dd. */
  nextDate: string;
}

const foldName = (value: string | null | undefined): string =>
  (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The panel's review mode: the detected patterns as a list (with a dismissed list to restore from),
 * and, once one is chosen, a prefilled form to confirm it. Nothing is saved here; the host does the
 * saving when this emits `add`, `dismiss` or `restore`.
 */
@Component({
  selector: 'app-pattern-review',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    DatePicker,
    CurrencyPipe,
  ],
  templateUrl: './pattern-review.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternReviewComponent implements OnInit {
  readonly patterns: InputSignal<RecurringSuggestion[]> = input.required<RecurringSuggestion[]>();
  readonly dismissed: InputSignal<DismissedPattern[]> = input.required<DismissedPattern[]>();
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();
  readonly accounts: InputSignal<Account[]> = input.required<Account[]>();
  /** The pattern being reviewed in the form, or null to show the list. */
  readonly selected: InputSignal<RecurringSuggestion | null> =
    input.required<RecurringSuggestion | null>();
  readonly saving: InputSignal<boolean> = input<boolean>(false);

  readonly choose: OutputEmitterRef<RecurringSuggestion> = output<RecurringSuggestion>();
  readonly backToList: OutputEmitterRef<void> = output<void>();
  readonly add: OutputEmitterRef<PatternAcceptance> = output<PatternAcceptance>();
  readonly dismiss: OutputEmitterRef<RecurringSuggestion> = output<RecurringSuggestion>();
  readonly restore: OutputEmitterRef<DismissedPattern> = output<DismissedPattern>();
  /** The text typed into the merchant search, for the host to narrow the list. */
  readonly merchantFilter: OutputEmitterRef<string> = output<string>();

  readonly showDismissed: WritableSignal<boolean> = signal(false);

  readonly frequencyOptions: { label: string; value: RecurringFrequency }[] = FREQUENCY_ORDER.map(
    (value: RecurringFrequency) => ({ label: FREQUENCY_LABELS[value], value }),
  );

  readonly form = new FormGroup({
    merchantId: new FormControl<number | null>(null, [Validators.required]),
    newMerchantName: new FormControl<string>('', { nonNullable: true }),
    accountId: new FormControl<number | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
      Validators.max(1_000_000),
    ]),
    frequency: new FormControl<RecurringFrequency | null>('MONTHLY', [Validators.required]),
    nextDate: new FormControl<Date | null>(null, [Validators.required]),
  });

  private readonly formEvents = toSignal(this.form.events);

  readonly creating: Signal<boolean> = computed((): boolean => {
    this.formEvents();
    return this.form.controls.merchantId.value === CREATE_MERCHANT_ID;
  });

  /** The form is valid, and a merchant to create has a name. */
  readonly canSubmit: Signal<boolean> = computed((): boolean => {
    this.formEvents();
    const nameOk: boolean =
      !this.creating() || this.form.controls.newMerchantName.value.trim().length > 0;
    return this.form.valid && nameOk;
  });

  /** Every merchant name seen so far, so a chosen merchant stays offered after a search narrows the list past it. */
  private readonly knownNames: Map<number, string> = new Map<number, string>();

  readonly merchantOptions: Signal<{ id: number; name: string }[]> = computed(() => {
    this.formEvents();
    const pattern: RecurringSuggestion | null = this.selected();
    const options: { id: number; name: string }[] = this.merchants().map((m: Merchant) => ({
      id: m.id,
      name: m.name,
    }));
    options.forEach((o): void => void this.knownNames.set(o.id, o.name));
    // the merchant this text is linked to, and the one chosen now, are always offered, even when the search missed them
    const keep: [number | null | undefined, string | null | undefined][] = [
      [pattern?.linkedMerchantId, pattern?.linkedMerchantName],
      [this.form.controls.merchantId.value, null],
    ];
    for (const [id, name] of keep) {
      if (id == null || id === CREATE_MERCHANT_ID || options.some((o): boolean => o.id === id)) {
        continue;
      }
      options.push({ id, name: name ?? this.knownNames.get(id) ?? 'Linked merchant' });
    }
    return [
      ...options,
      { id: CREATE_MERCHANT_ID, name: `Create "${(pattern?.merchant?.name ?? '').trim()}"` },
    ];
  });

  /** Why the account is empty, so the disabled Add button is not a mystery; null once an account is chosen. */
  readonly accountHint: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    if (this.form.controls.accountId.value !== null) return null;
    const known: boolean = this.accounts().some(
      (a: Account): boolean => a.id === this.selected()?.accountId,
    );
    return this.selected()?.accountId != null && !known
      ? 'The account this was found on is not in your accounts. Choose one to add it.'
      : 'Choose an account to add it.';
  });

  private filledFor: string | null = null;

  constructor() {
    effect((): void => {
      const key: string | null = this.selected()?.patternKey ?? null;
      if (key === this.filledFor) return;
      untracked((): void => this.fill(key));
    });
  }

  /** Fills the form before the first render so early typing is never wiped by a later effect. */
  ngOnInit(): void {
    const key: string | null = this.selected()?.patternKey ?? null;
    if (key !== this.filledFor) this.fill(key);
  }

  private fill(key: string | null): void {
    this.filledFor = key;
    const pattern: RecurringSuggestion | null = this.selected();
    if (!pattern) {
      return;
    }
    const detected: string = pattern.merchant?.name ?? '';
    const match: Merchant | undefined = this.merchants().find(
      (m: Merchant): boolean => foldName(m.name) === foldName(detected),
    );
    const accountKnown: boolean = this.accounts().some(
      (a: Account): boolean => a.id === pattern.accountId,
    );
    this.form.reset({
      merchantId: pattern.linkedMerchantId ?? (match ? match.id : CREATE_MERCHANT_ID),
      newMerchantName: detected.trim(),
      accountId: accountKnown ? (pattern.accountId as number) : null,
      amount: pattern.amount,
      frequency: pattern.frequency,
      nextDate: pattern.nextDate ? fromLocalDateString(pattern.nextDate) : null,
    });
  }

  confidence(pattern: RecurringSuggestion): string {
    return confidenceLabel(pattern.confidenceScore);
  }

  frequencyLabel(pattern: RecurringSuggestion): string {
    return FREQUENCY_LABELS[pattern.frequency];
  }

  historyDate(value: string): string {
    return shortDate(value);
  }

  onMerchantFilter(term: string): void {
    this.merchantFilter.emit(term);
  }

  /** Accepts the pattern with what the form holds; does nothing while the form is not valid. */
  submit(): void {
    const pattern: RecurringSuggestion | null = this.selected();
    if (!pattern || this.saving()) return;
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const creating: boolean = raw.merchantId === CREATE_MERCHANT_ID;
    this.add.emit({
      pattern,
      merchantId: creating ? null : (raw.merchantId as number),
      merchantName: creating
        ? null
        : (this.merchantOptions().find((o) => o.id === raw.merchantId)?.name ?? null),
      newMerchantName: creating ? raw.newMerchantName.trim() : null,
      accountId: raw.accountId as number,
      amount: raw.amount as number,
      frequency: raw.frequency as RecurringFrequency,
      nextDate: toLocalDateString(raw.nextDate as Date),
    });
  }
}
