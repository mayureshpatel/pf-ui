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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { Category, CategoryGroup } from '@models/category.model';
import {
  CategoryRule,
  CategoryRuleCreateRequest,
  CategoryRuleUpdateRequest,
  MatchType,
} from '@models/category-rule.model';
import {
  amountRangeError,
  joinKeywords,
  keywordTooLong,
  parseKeywords,
} from '../../../utils/settings-helpers';

/** What the form hands the host for a new rule (the host adds the user). */
export type RuleCreateValue = Omit<CategoryRuleCreateRequest, 'userId'>;

const MATCH_TYPE_OPTIONS: { label: string; value: MatchType }[] = [
  { label: 'Any keyword', value: 'OR' },
  { label: 'All keywords', value: 'AND' },
];

/** The keywords box needs at least one keyword and none over the server's length limit. */
function keywordsValidator(control: AbstractControl<string>): ValidationErrors | null {
  const keywords: string[] = parseKeywords(control.value ?? '');
  if (keywords.length === 0) return { required: true };
  return keywordTooLong(keywords) ? { maxlength: true } : null;
}

function amountRangeValidator(group: AbstractControl): ValidationErrors | null {
  const min: number | null = group.get('minAmount')?.value ?? null;
  const max: number | null = group.get('maxAmount')?.value ?? null;
  return amountRangeError(min, max) ? { range: true } : null;
}

/**
 * One form for adding and editing a category rule, shown in the Settings panel. Nothing is saved here:
 * `submit()` (called from the panel's Save button) emits the create or update request for the host.
 */
@Component({
  selector: 'app-rule-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputNumberModule, InputTextModule, SelectModule],
  templateUrl: './rule-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleEditFormComponent implements OnInit {
  /** The rule being edited (null when adding one). */
  readonly rule: InputSignal<CategoryRule | null> = input<CategoryRule | null>(null);
  /** Categories grouped under their parents, for the category choice. */
  readonly groups: InputSignal<CategoryGroup[]> = input.required<CategoryGroup[]>();
  readonly saving: InputSignal<boolean> = input<boolean>(false);

  readonly save: OutputEmitterRef<RuleCreateValue | CategoryRuleUpdateRequest> = output<
    RuleCreateValue | CategoryRuleUpdateRequest
  >();
  readonly remove: OutputEmitterRef<void> = output<void>();

  /** A message the form itself cannot express, such as the server's refusal. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  readonly matchTypeOptions = MATCH_TYPE_OPTIONS;

  readonly form = new FormGroup(
    {
      keywordsInput: new FormControl<string>('', {
        nonNullable: true,
        validators: [keywordsValidator],
      }),
      matchType: new FormControl<MatchType>('OR', { nonNullable: true }),
      category: new FormControl<Category | null>(null, { validators: [Validators.required] }),
      priority: new FormControl<number>(0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0)],
      }),
      minAmount: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
      maxAmount: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    },
    { validators: [amountRangeValidator] },
  );

  readonly isEditMode: Signal<boolean> = computed((): boolean => this.rule() !== null);

  /** Which rule (or a new one) is shown; the form resets only when it changes. */
  private readonly formKey: Signal<string> = computed((): string =>
    String(this.rule()?.id ?? 'new'),
  );
  private filledFor: string | null = null;

  /** Re-evaluates the messages below whenever the form's value or state changes. */
  private readonly formEvents = toSignal(this.form.events);

  readonly keywordsError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.form.controls.keywordsInput;
    if (!control.errors || !control.touched) return null;
    return control.errors['maxlength']
      ? 'Each keyword must be 255 characters or fewer.'
      : 'Enter at least one keyword.';
  });

  readonly categoryError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.form.controls.category;
    return control.invalid && control.touched ? 'Choose a category.' : null;
  });

  readonly priorityError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.form.controls.priority;
    return control.invalid && control.touched ? 'Priority must be 0 or more.' : null;
  });

  readonly amountError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const { minAmount, maxAmount } = this.form.controls;
    if ((minAmount.invalid && minAmount.touched) || (maxAmount.invalid && maxAmount.touched)) {
      return 'Amounts must be 0 or more.';
    }
    const touched: boolean = minAmount.touched || maxAmount.touched;
    return touched ? amountRangeError(minAmount.value, maxAmount.value) : null;
  });

  constructor() {
    effect((): void => {
      const key: string = this.formKey();
      if (key === this.filledFor) return;
      untracked((): void => this.fill(key));
    });
  }

  /** Fills synchronously before the first render, so text typed at once is never wiped by the effect. */
  ngOnInit(): void {
    const key: string = this.formKey();
    if (key !== this.filledFor) this.fill(key);
  }

  private fill(key: string): void {
    this.filledFor = key;
    this.errorMessage.set(null);
    const rule: CategoryRule | null = this.rule();
    this.form.reset({
      keywordsInput: rule ? joinKeywords(rule.keywords) : '',
      matchType: rule?.matchType ?? 'OR',
      category: rule ? this.categoryOf(rule) : null,
      priority: rule?.priority ?? 0,
      minAmount: rule?.minAmount ?? null,
      maxAmount: rule?.maxAmount ?? null,
    });
  }

  /** The rule's category as the grouped list knows it (so the select shows it), else as the rule has it. */
  private categoryOf(rule: CategoryRule): Category {
    const known: Category | undefined = this.groups()
      .flatMap((g: CategoryGroup): Category[] => [g.parent, ...g.items])
      .find((c: Category): boolean => c.id === rule.category?.id);
    return known ?? rule.category;
  }

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    this.errorMessage.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    if (!raw.category) return;

    const common = {
      keywords: parseKeywords(raw.keywordsInput),
      matchType: raw.matchType,
      categoryId: raw.category.id,
      priority: raw.priority,
      minAmount: raw.minAmount,
      maxAmount: raw.maxAmount,
    };
    const editing: CategoryRule | null = this.rule();
    this.save.emit(editing ? { id: editing.id, ...common } : common);
  }
}
