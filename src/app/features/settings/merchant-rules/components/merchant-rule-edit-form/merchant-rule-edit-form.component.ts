import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  Signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { Merchant } from '@models/merchant.model';
import {
  MerchantRule,
  MerchantRuleCreateRequest,
  MerchantRuleDraft,
  MerchantRuleUpdateRequest,
} from '@models/merchant-rule.model';
import { createRuleForm, RuleFormBase, RuleFormControls } from '../../../rule-form/rule-form-base';
import { RuleFormFieldsComponent } from '../../../rule-form/rule-form-fields.component';

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

  readonly save: OutputEmitterRef<MerchantRuleCreateRequest | MerchantRuleUpdateRequest> = output<
    MerchantRuleCreateRequest | MerchantRuleUpdateRequest
  >();

  /**
   * The merchant choices: the user's merchants, plus the rule's own merchant when the list does not
   * hold it (the list is capped), so the select can always show what the rule uses.
   */
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
    return { merchantId: this.form.getRawValue().merchant?.id ?? null };
  }

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    if (!this.prepareSubmit()) return;
    const merchant: Merchant | null = this.form.getRawValue().merchant;
    if (!merchant) return;

    const common = { ...this.commonValue(), merchantId: merchant.id };
    const editing: MerchantRule | null = this.rule();
    this.save.emit(editing ? { id: editing.id, ...common } : common);
  }
}
