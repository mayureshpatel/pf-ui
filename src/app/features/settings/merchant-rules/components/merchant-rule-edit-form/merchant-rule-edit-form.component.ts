import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { Merchant } from '@models/merchant.model';
import {
  MerchantRule,
  MerchantRuleCreateRequest,
  MerchantRuleDraft,
  MerchantRuleNewMerchantRequest,
  MerchantRuleUpdateRequest,
} from '@models/merchant-rule.model';
import { createRuleForm, RuleFormBase, RuleFormControls } from '../../../rule-form/rule-form-base';
import { merchantOptions, NEW_MERCHANT_ID } from '../../utils/merchant-options';
import { RuleFormFieldsComponent } from '../../../rule-form/rule-form-fields.component';

export { NEW_MERCHANT_ID };

type MerchantRuleForm = FormGroup<RuleFormControls & { merchant: FormControl<Merchant | null> }>;

/**
 * One form for adding and editing a merchant rule, shown in the Settings panel. The fields every
 * rule shares come from {@link RuleFormBase}; only the merchant choice is its own. Nothing is saved
 * here: `submit()` (called from the panel's Save button) emits the create or update request.
 */
@Component({
  selector: 'app-merchant-rule-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, SelectModule, RuleFormFieldsComponent],
  templateUrl: './merchant-rule-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantRuleEditFormComponent extends RuleFormBase<
  MerchantRule,
  MerchantRuleForm,
  MerchantRuleDraft
> {
  /** The user's merchants, for the merchant choice. */
  readonly merchants: InputSignal<Merchant[]> = input.required<Merchant[]>();

  /** Emits the name of the chosen merchant (null when none), for hosts that preview what rows would become. */
  readonly merchantChange: OutputEmitterRef<string | null> = output<string | null>();

  readonly save: OutputEmitterRef<
    MerchantRuleCreateRequest | MerchantRuleUpdateRequest | MerchantRuleNewMerchantRequest
  > = output<
    MerchantRuleCreateRequest | MerchantRuleUpdateRequest | MerchantRuleNewMerchantRequest
  >();

  /**
   * The merchant choices: the user's merchants, plus the rule's own merchant when the list does not
   * hold it (the list is capped), so the select can always show what the rule uses.
   */
  /** Whether the merchant field may offer to create a merchant from a typed name (PF-933); off in Settings. */
  readonly allowCreate: InputSignal<boolean> = input<boolean>(false);

  /** What the user has typed in the merchant field's search, trimmed. */
  private readonly filterText: WritableSignal<string> = signal('');

  protected readonly choices: Signal<Merchant[]> = computed((): Merchant[] => {
    const merchants: Merchant[] = this.merchants();
    const own: Merchant | null | undefined = this.rule()?.merchant;
    if (!own || merchants.some((m: Merchant): boolean => m.id === own.id)) return merchants;
    return [...merchants, own];
  });

  readonly merchantError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.form.controls.merchant;
    return control.invalid && control.touched ? 'Choose a merchant.' : null;
  });

  constructor() {
    super();
    this.form.controls.merchant.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((merchant: Merchant | null): void =>
        this.merchantChange.emit(merchant?.name ?? null),
      );
  }

  /**
   * The merchants to choose from, plus a "Create" option for what has been typed when the host
   * allows creating and no merchant already has that name (ignoring case), so a name is never
   * created twice.
   */
  readonly options: Signal<Merchant[]> = computed((): Merchant[] =>
    merchantOptions(this.choices(), this.filterText(), this.allowCreate()),
  );

  /** Remembers what the user is searching the merchants for. */
  onMerchantFilter(event: { filter?: string | null }): void {
    this.filterText.set((event.filter ?? '').trim());
  }

  /** True for the "Create" option, which has no real merchant behind it yet. */
  protected isCreateOption(merchant: Merchant): boolean {
    return merchant.id === NEW_MERCHANT_ID;
  }

  protected buildForm(): MerchantRuleForm {
    return createRuleForm({
      merchant: new FormControl<Merchant | null>(null, { validators: [Validators.required] }),
    });
  }

  protected targetKey(rule: MerchantRule): unknown {
    return rule.merchant?.id ?? null;
  }

  protected targetValue(rule: MerchantRule | null): Record<string, unknown> {
    if (!rule) return { merchant: null };
    const known: Merchant | undefined = this.choices().find(
      (m: Merchant): boolean => m.id === rule.merchant?.id,
    );
    return { merchant: known ?? rule.merchant ?? null };
  }

  protected override draftExtras(): Partial<MerchantRuleDraft> {
    const merchant: Merchant | null = this.form.getRawValue().merchant;
    return { merchantId: merchant && merchant.id !== NEW_MERCHANT_ID ? merchant.id : null };
  }

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    if (!this.prepareSubmit()) return;
    const merchant: Merchant | null = this.form.getRawValue().merchant;
    if (!merchant) return;
    const editing: MerchantRuleDraft | MerchantRule | null = this.rule();
    if (merchant.id === NEW_MERCHANT_ID) {
      this.save.emit({ ...this.commonValue(), newMerchantName: merchant.name });
      return;
    }
    const common = { ...this.commonValue(), merchantId: merchant.id };
    this.save.emit(editing ? { id: (editing as MerchantRule).id, ...common } : common);
  }
}
