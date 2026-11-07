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
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { Category, CategoryGroup } from '@models/category.model';
import {
  CategoryRule,
  CategoryRuleCreateRequest,
  CategoryRuleUpdateRequest,
} from '@models/category-rule.model';
import { createRuleForm, RuleFormBase, RuleFormControls } from '../../../rule-form/rule-form-base';
import { RuleFormFieldsComponent } from '../../../rule-form/rule-form-fields.component';

/** What the form hands the host for a new rule (the host adds the user). */
export type RuleCreateValue = Omit<CategoryRuleCreateRequest, 'userId'>;

type CategoryRuleForm = FormGroup<RuleFormControls & { category: FormControl<Category | null> }>;

/**
 * One form for adding and editing a category rule, shown in the Settings panel. The fields every
 * rule shares come from {@link RuleFormBase}; only the category choice is its own. Nothing is saved
 * here: `submit()` (called from the panel's Save button) emits the create or update request.
 */
@Component({
  selector: 'app-rule-edit-form',
  standalone: true,
  imports: [ReactiveFormsModule, SelectModule, RuleFormFieldsComponent],
  templateUrl: './rule-edit-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleEditFormComponent extends RuleFormBase<CategoryRule, CategoryRuleForm> {
  /** Categories grouped under their parents, for the category choice. */
  readonly groups: InputSignal<CategoryGroup[]> = input.required<CategoryGroup[]>();

  /** Emits the name of the chosen category (null when none), for hosts that preview what rows would become. */
  readonly categoryChange: OutputEmitterRef<string | null> = output<string | null>();

  readonly save: OutputEmitterRef<RuleCreateValue | CategoryRuleUpdateRequest> = output<
    RuleCreateValue | CategoryRuleUpdateRequest
  >();

  /**
   * The category choices: the grouped list, plus the rule's own category when it isn't in it (an older
   * rule may point at a parent category), so the select can always show what the rule uses.
   */
  protected readonly choices: Signal<CategoryGroup[]> = computed((): CategoryGroup[] => {
    const groups: CategoryGroup[] = this.groups();
    const own: Category | null | undefined = this.rule()?.category;
    if (!own) return groups;
    const listed: boolean = groups.some((g: CategoryGroup) =>
      g.items.some((c: Category) => c.id === own.id),
    );
    return listed ? groups : [...groups, { parent: own, items: [own] }];
  });

  readonly categoryError: Signal<string | null> = computed((): string | null => {
    this.formEvents();
    const control = this.form.controls.category;
    return control.invalid && control.touched ? 'Choose a category.' : null;
  });

  constructor() {
    super();
    this.form.controls.category.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((category: Category | null): void =>
        this.categoryChange.emit(category?.name ?? null),
      );
  }

  protected buildForm(): CategoryRuleForm {
    return createRuleForm({
      category: new FormControl<Category | null>(null, { validators: [Validators.required] }),
    });
  }

  protected targetKey(rule: CategoryRule): unknown {
    return rule.category?.id ?? null;
  }

  protected targetValue(rule: CategoryRule | null): Record<string, unknown> {
    return { category: rule ? this.categoryOf(rule) : null };
  }

  /** The rule's category as the grouped list knows it (so the select shows it), else as the rule has it. */
  private categoryOf(rule: CategoryRule): Category | null {
    const known: Category | undefined = this.choices()
      .flatMap((g: CategoryGroup): Category[] => g.items)
      .find((c: Category): boolean => c.id === rule.category?.id);
    return known ?? rule.category ?? null;
  }

  /** Submits from outside (the panel's Save button). */
  submit(): void {
    if (!this.prepareSubmit()) return;
    const category: Category | null = this.form.getRawValue().category;
    if (!category) return;

    const common = { ...this.commonValue(), categoryId: category.id };
    const editing: CategoryRule | null = this.rule();
    this.save.emit(editing ? { id: editing.id, ...common } : common);
  }
}
