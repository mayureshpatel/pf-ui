import {
  computed,
  Directive,
  effect,
  input,
  InputSignal,
  OnInit,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatchType, RuleDraft } from '@models/category-rule.model';
import {
  amountRangeError,
  joinKeywords,
  keywordTooLong,
  MAX_KEYWORDS,
  parseKeywords,
} from '../utils/settings-helpers';
import { RuleFormFieldsComponent } from './rule-form-fields.component';

/** The server stores priority as a 32-bit integer. */
export const MAX_PRIORITY = 2_147_483_647;

export const MATCH_TYPE_OPTIONS: { label: string; value: MatchType }[] = [
  { label: 'Any keyword', value: 'OR' },
  { label: 'All keywords', value: 'AND' },
];

/**
 * The keywords box needs at least one keyword, at most the server's count limit, and none over its
 * length limit.
 */
function keywordsValidator(control: AbstractControl<string>): ValidationErrors | null {
  const keywords: string[] = parseKeywords(control.value ?? '');
  if (keywords.length === 0) return { required: true };
  if (keywords.length > MAX_KEYWORDS) return { maxcount: true };
  return keywordTooLong(keywords) ? { maxlength: true } : null;
}

/** Whether the keywords box fails for a reason other than being empty. */
function hasBadKeywords(control: AbstractControl<string>): boolean {
  return control.invalid && !control.hasError('required');
}

function amountRangeValidator(group: AbstractControl): ValidationErrors | null {
  const min: number | null = group.get('minAmount')?.value ?? null;
  const max: number | null = group.get('maxAmount')?.value ?? null;
  return amountRangeError(min, max) ? { range: true } : null;
}

/** The controls every rule form has; a form adds its target (category, merchant) beside them. */
export interface RuleFormControls {
  keywordsInput: FormControl<string>;
  matchType: FormControl<MatchType>;
  priority: FormControl<number>;
  minAmount: FormControl<number | null>;
  maxAmount: FormControl<number | null>;
}

/** The raw value of the shared controls. */
interface RuleFormValue {
  keywordsInput: string;
  matchType: MatchType;
  priority: number;
  minAmount: number | null;
  maxAmount: number | null;
}

/** The rule fields the form reads from a rule it is editing. */
export interface RuleLike {
  id: number;
  keywords: string[];
  matchType: MatchType;
  priority: number;
  minAmount: number | null;
  maxAmount: number | null;
}

/** The shared controls and validators, plus the form's own `target` controls. */
export function createRuleForm<T extends Record<string, AbstractControl>>(
  target: T,
): FormGroup<RuleFormControls & T> {
  const common: RuleFormControls = {
    keywordsInput: new FormControl<string>('', {
      nonNullable: true,
      validators: [keywordsValidator],
    }),
    matchType: new FormControl<MatchType>('OR', { nonNullable: true }),
    priority: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(MAX_PRIORITY)],
    }),
    minAmount: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    maxAmount: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
  };
  return new FormGroup<RuleFormControls & T>({ ...common, ...target }, [amountRangeValidator]);
}

/**
 * Everything a rule form does apart from its target field: filling from the rule being edited,
 * the keyword / priority / amount messages, the draft the match list previews, focus and
 * submitting. A subclass supplies the form (via {@link createRuleForm}), the target's value and
 * template (the target field goes inside `<app-rule-form-fields>`), and its own `save` output.
 * Nothing is saved here: `submit()` (called from the panel's Save button) emits the request.
 */
@Directive()
export abstract class RuleFormBase<
  TRule extends RuleLike,
  TForm extends FormGroup,
  TDraft extends RuleDraft = RuleDraft,
> implements OnInit {
  /** The rule being edited (null when adding one). */
  readonly rule: InputSignal<TRule | null> = input<TRule | null>(null);
  readonly saving: InputSignal<boolean> = input<boolean>(false);
  /** Prefills the keywords of a new rule (ignored when `rule` is set); it does not make the form dirty. */
  readonly initialKeyword: InputSignal<string> = input<string>('');

  readonly remove: OutputEmitterRef<void> = output<void>();
  /**
   * The rule as drafted so far (target aside, unless the subclass adds it), for the match list: on
   * init and whenever keywords, match type, priority or range change. Null while there is no
   * keyword, or while the keywords are ones the server would refuse (see `keywordsInvalid`).
   * Repeats are not re-emitted.
   */
  readonly draftChange: OutputEmitterRef<TDraft | null> = output<TDraft | null>();

  /** A message the form itself cannot express, such as the server's refusal. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  // built by the subclass; a method, so it is there while this field initializes
  readonly form: TForm = this.buildForm();

  /** The shared controls of the form, typed (the form's own type also carries its target). */
  private get shared(): RuleFormControls {
    return this.form.controls as unknown as RuleFormControls;
  }

  readonly isEditMode: Signal<boolean> = computed((): boolean => this.rule() !== null);

  /** Which rule (or a new one) is shown; the form resets only when it changes. */
  private readonly formKey: Signal<string> = computed((): string =>
    String(this.rule()?.id ?? 'new'),
  );
  /** What the open rule's fields were when the form was last filled, to tell a changed copy from the same one. */
  private readonly contentKey: Signal<string> = computed((): string => {
    const r: TRule | null = this.rule();
    return r
      ? JSON.stringify([
          r.keywords,
          r.matchType,
          r.priority,
          this.targetKey(r),
          r.minAmount ?? null,
          r.maxAmount ?? null,
        ])
      : '';
  });
  private filledFor: string | null = null;
  private filledContent: string | null = null;

  /** Re-evaluates the messages below whenever the form's value or state changes. */
  protected readonly formEvents = toSignal(this.form.events);

  /**
   * Why the keywords are refused. Too many or too long shows while typing (the match list waits on
   * a fix, so the reason must be there at once); merely empty waits until the field is left.
   */
  readonly keywordsError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.shared.keywordsInput;
    if (!control.errors) return null;
    if (control.errors['maxcount']) return `Use at most ${MAX_KEYWORDS} keywords.`;
    if (control.errors['maxlength']) return 'Each keyword must be 255 characters or fewer.';
    return control.touched ? 'Enter at least one keyword.' : null;
  });

  /**
   * True while the keywords box holds keywords the server would refuse (too many, or one too long),
   * as opposed to none at all; the draft is null then, and the match list asks for a fix.
   */
  readonly keywordsInvalid: Signal<boolean> = computed((): boolean => {
    this.formEvents();
    return hasBadKeywords(this.shared.keywordsInput);
  });

  readonly priorityError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.shared.priority;
    if (!control.invalid || !control.touched) return null;
    return control.errors?.['max']
      ? 'Priority must be 2,147,483,647 or less.'
      : 'Priority must be 0 or more.';
  });

  readonly amountError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const { minAmount, maxAmount } = this.shared;
    if ((minAmount.invalid && minAmount.touched) || (maxAmount.invalid && maxAmount.touched)) {
      return 'Amounts must be 0 or more.';
    }
    const touched: boolean = minAmount.touched || maxAmount.touched;
    return touched ? amountRangeError(minAmount.value, maxAmount.value) : null;
  });

  private lastDraft: string | null = null;
  private readonly fields: Signal<RuleFormFieldsComponent | undefined> =
    viewChild(RuleFormFieldsComponent);

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((): void => this.emitDraft());
    effect((): void => {
      const key: string = this.formKey();
      const content: string = this.contentKey();
      // another rule or a new one always refills; a changed copy of the same rule (edited elsewhere,
      // or its keywords normalised by the save) refills only while the user has typed nothing
      const changedCopy: boolean = content !== this.filledContent;
      if (
        key === this.filledFor &&
        !(changedCopy && untracked((): boolean => this.form.pristine))
      ) {
        return;
      }
      untracked((): void => this.fill(key));
    });
  }

  /** Builds the form: {@link createRuleForm} with the subclass's target control(s). */
  protected abstract buildForm(): TForm;

  /** What identifies the rule's target in the rule, to tell a changed copy from the same one. */
  protected abstract targetKey(rule: TRule): unknown;

  /** The target controls' values for the rule (or for a new one, when null). */
  protected abstract targetValue(rule: TRule | null): Record<string, unknown>;

  /** Fields the draft carries beyond the shared ones (e.g. the chosen merchant). */
  protected draftExtras(): Partial<TDraft> {
    return {};
  }

  /** Fills synchronously before the first render, so text typed at once is never wiped by the effect. */
  ngOnInit(): void {
    const key: string = this.formKey();
    if (key !== this.filledFor) this.fill(key);
  }

  private fill(key: string): void {
    this.filledFor = key;
    this.filledContent = this.contentKey();
    this.errorMessage.set(null);
    const rule: TRule | null = this.rule();
    this.form.reset({
      keywordsInput: rule ? joinKeywords(rule.keywords) : this.initialKeyword(),
      matchType: rule?.matchType ?? 'OR',
      priority: rule?.priority ?? 0,
      minAmount: rule?.minAmount ?? null,
      maxAmount: rule?.maxAmount ?? null,
      ...this.targetValue(rule),
    } as never);
    this.emitDraft();
  }

  /**
   * Emits the current draft unless it is the one emitted last. Keywords the server would refuse
   * give null, like no keyword, so the preview never asks for something that can only fail.
   */
  private emitDraft(): void {
    const raw: RuleFormValue = this.form.getRawValue();
    const keywords: string[] = parseKeywords(raw.keywordsInput);
    const draft: TDraft | null =
      keywords.length === 0 || hasBadKeywords(this.shared.keywordsInput)
        ? null
        : ({
            ruleId: this.rule()?.id ?? null,
            keywords,
            matchType: raw.matchType,
            priority: raw.priority ?? 0,
            minAmount: raw.minAmount ?? null,
            maxAmount: raw.maxAmount ?? null,
            ...this.draftExtras(),
          } as TDraft);
    const key: string = JSON.stringify(draft);
    if (key === this.lastDraft) return;
    this.lastDraft = key;
    this.draftChange.emit(draft);
  }

  /** The shared fields of the request, from the form's current value. */
  protected commonValue(): {
    keywords: string[];
    matchType: MatchType;
    priority: number;
    minAmount: number | null;
    maxAmount: number | null;
  } {
    const raw: RuleFormValue = this.form.getRawValue();
    return {
      keywords: parseKeywords(raw.keywordsInput),
      matchType: raw.matchType,
      priority: raw.priority,
      minAmount: raw.minAmount,
      maxAmount: raw.maxAmount,
    };
  }

  /** Moves focus to the keywords field (a host that opens the form calls this). */
  focusKeywords(): void {
    this.fields()?.focusKeywords();
  }

  /**
   * Marks everything touched and clears the last message.
   * @returns whether the form may be sent (valid, and not already saving)
   */
  protected prepareSubmit(): boolean {
    this.errorMessage.set(null);
    this.form.markAllAsTouched();
    return !this.form.invalid && !this.saving();
  }
}
