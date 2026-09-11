import {
  Component,
  inject,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {InputNumberModule} from 'primeng/inputnumber';
import {SelectModule} from 'primeng/select';
import {MessageModule} from 'primeng/message';

import {CategoryRuleApiService} from '../../services/category-rule-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {Category, CategoryGroup} from '@models/category.model';
import {CategoryRuleCreateRequest, MatchType} from '@models/category-rule.model';
import {DrawerComponent} from '@shared/components/drawer/drawer.component';

/**
 * Requires at least one non-blank, comma-separated keyword in the raw input string.
 */
function atLeastOneKeywordValidator(control: AbstractControl<string>): ValidationErrors | null {
  const hasKeyword = (control.value ?? '')
    .split(',')
    .map((keyword: string): string => keyword.trim())
    .some((keyword: string): boolean => keyword.length > 0);
  return hasKeyword ? null : {required: true};
}

/** Options for the match-type selector. */
const MATCH_TYPE_OPTIONS: { label: string; value: MatchType }[] = [
  {label: 'Match ANY keyword (OR)', value: 'OR'},
  {label: 'Match ALL keywords (AND)', value: 'AND'}
];

/**
 * Drawer component for creating new transaction categorization rules.
 *
 * Allows users to define one or more keywords (with AND/OR match logic), assign a target
 * category, and set an optional priority and amount range for rule precedence.
 *
 * A `p-dialog` originally, migrated to `DrawerComponent` by PF-803 alongside `budget-form-dialog`
 * -- PrimeNG 21.1.3's `p-select` silently fails to register a clicked option when hosted inside a
 * `p-dialog`. See `budget-form-dialog.component.ts`'s docstring for the full investigation.
 */
@Component({
  selector: 'app-category-rule-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    MessageModule,
    DrawerComponent
  ],
  templateUrl: './category-rule-form-dialog.component.html'
})
export class CategoryRuleFormDialogComponent {
  private readonly api: CategoryRuleApiService = inject(CategoryRuleApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** Emitted when a rule is successfully created. */
  readonly save: OutputEmitterRef<void> = output<void>();

  /** Grouped categories available for assignment. */
  readonly categoryGroups: WritableSignal<CategoryGroup[]> = signal([]);

  /** Options for the match-type selector. */
  readonly matchTypeOptions = MATCH_TYPE_OPTIONS;

  /** Indicates if a creation operation is in flight. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Holds validation or API error messages. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Strongly typed form for rule configuration. `keywordsInput` holds the raw comma-separated
   * text as typed; it's split into the real string[] payload on submit.
   */
  readonly form = new FormGroup({
    keywordsInput: new FormControl<string>('', {
      nonNullable: true,
      validators: [atLeastOneKeywordValidator]
    }),
    matchType: new FormControl<MatchType>('OR', {nonNullable: true}),
    category: new FormControl<Category | null>(null, {
      validators: [Validators.required]
    }),
    priority: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.min(0)]
    }),
    minAmount: new FormControl<number | null>(null, {
      validators: [Validators.min(0)]
    }),
    maxAmount: new FormControl<number | null>(null, {
      validators: [Validators.min(0)]
    })
  });

  /**
   * Resets the form and reloads categories whenever the drawer is shown.
   */
  onShow(): void {
    this.form.reset({keywordsInput: '', matchType: 'OR', category: null, priority: 0, minAmount: null, maxAmount: null});
    this.errorMessage.set(null);
    this.loadCategories();
  }

  /**
   * Fetches grouped categories for the dropdown selection.
   */
  private loadCategories(): void {
    this.categoryApi.getGroupedCategories().subscribe({
      next: (groups: CategoryGroup[]): void => this.categoryGroups.set(groups),
      error: (err: any): void => {
        console.error('Failed to load categories:', err);
        this.toast.error('Failed to load categories.');
      }
    });
  }

  /**
   * Validates and submits the rule to the API.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    const {keywordsInput, matchType, category, priority, minAmount, maxAmount} = this.form.getRawValue();
    if (!category) return;

    const keywords: string[] = keywordsInput
      .split(',')
      .map((keyword: string): string => keyword.trim())
      .filter((keyword: string): boolean => keyword.length > 0);

    this.loading.set(true);
    this.errorMessage.set(null);

    const request = {
      keywords,
      matchType,
      categoryId: category.id,
      priority,
      minAmount,
      maxAmount
    } as CategoryRuleCreateRequest

    this.api.createRule(request)
      .pipe(finalize((): void => this.loading.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success('Category rule created.');
          this.save.emit();
          this.visible.set(false);
        },
        error: (err: any): void => {
          console.error('Create rule failed:', err);
          this.errorMessage.set(err.error?.detail || 'Failed to create rule.');
        }
      });
  }
}
