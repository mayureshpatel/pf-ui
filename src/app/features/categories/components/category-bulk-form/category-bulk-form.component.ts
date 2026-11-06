import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import {
  CategoryBatchGroup,
  CategoryBatchRequest,
  CategoryBatchResult,
  CategoryType,
} from '@models/category.model';
import { CATEGORY_COLORS, getCategoryColor } from '@shared/utils/category.utils';
import {
  BULK_MAX_GROUPS,
  BULK_MAX_NAME_LENGTH,
  BULK_MAX_NAMES,
  categoryCount,
  overLongNames,
  parseNames,
  preview,
} from '../../utils/category-bulk';
import {
  CATEGORY_ICONS,
  CATEGORY_TYPE_OPTIONS,
  COLOR_NAMES,
} from '../category-edit-form/category-edit-form.component';

type GroupForm = FormGroup<{
  name: FormControl<string>;
  type: FormControl<CategoryType>;
  color: FormControl<string>;
  icon: FormControl<string>;
  subcategories: FormControl<string>;
}>;

/** What one group card will create, worked out from its fields. */
interface GroupSummary {
  nameMissing: boolean;
  nameTooLong: boolean;
  subcategoryCount: number;
  tooLong: string[];
}

/** The panel's bulk mode: several parents, each with a list of subcategories typed one per line. */
@Component({
  selector: 'app-category-bulk-form',
  standalone: true,
  imports: [ReactiveFormsModule, InputTextModule, SelectModule, TextareaModule],
  templateUrl: './category-bulk-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryBulkFormComponent {
  /** The outcome of the last successful request, shown instead of the form when set. */
  readonly result: InputSignal<CategoryBatchResult | null> = input<CategoryBatchResult | null>(
    null,
  );
  readonly saving: InputSignal<boolean> = input<boolean>(false);
  /** The error from a failed request (nothing was created), shown above the summary. */
  readonly errorMessage: InputSignal<string | null> = input<string | null>(null);

  readonly save: OutputEmitterRef<CategoryBatchRequest> = output<CategoryBatchRequest>();
  /** The result view's Done button. */
  readonly done: OutputEmitterRef<void> = output<void>();

  readonly colors: string[] = CATEGORY_COLORS;
  readonly colorNames: string[] = COLOR_NAMES;
  readonly icons: string[] = CATEGORY_ICONS;
  readonly typeOptions = CATEGORY_TYPE_OPTIONS;
  readonly maxGroups: number = BULK_MAX_GROUPS;
  readonly maxNames: number = BULK_MAX_NAMES;
  readonly maxNameLength: number = BULK_MAX_NAME_LENGTH;

  private readonly groups = new FormArray<GroupForm>([this.newGroup()]);
  readonly form = new FormGroup({ groups: this.groups });
  /** The cards on screen, mirrored from the form array so the template tracks adds and removes. */
  readonly cards: WritableSignal<GroupForm[]> = signal<GroupForm[]>([...this.groups.controls]);

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>);
  private readonly injector: Injector = inject(Injector);
  readonly categoryCount = categoryCount;
  private readonly formEvents = toSignal(this.form.events);

  /** Per card: what it will create and what is wrong with it. */
  readonly summaries: Signal<GroupSummary[]> = computed((): GroupSummary[] => {
    this.formEvents();
    return this.cards().map((card: GroupForm): GroupSummary => {
      const raw = card.getRawValue();
      const names: string[] = parseNames(raw.subcategories);
      const name: string = raw.name.trim();
      return {
        nameMissing: name === '',
        nameTooLong: name.length > BULK_MAX_NAME_LENGTH,
        subcategoryCount: names.length,
        tooLong: overLongNames(names),
      };
    });
  });

  readonly parentCount: Signal<number> = computed((): number => this.cards().length);
  readonly subcategoryTotal: Signal<number> = computed((): number =>
    this.summaries().reduce((sum: number, s: GroupSummary): number => sum + s.subcategoryCount, 0),
  );
  readonly totalNames: Signal<number> = computed(
    (): number => this.parentCount() + this.subcategoryTotal(),
  );

  /** Problems that apply to the whole batch, each naming the value or the number involved. */
  readonly problems: Signal<string[]> = computed((): string[] => {
    this.formEvents();
    const problems: string[] = [];
    if (this.parentCount() > BULK_MAX_GROUPS) {
      problems.push(
        `You can add at most ${BULK_MAX_GROUPS} parents at once; there are ${this.parentCount()}.`,
      );
    }
    if (this.totalNames() > BULK_MAX_NAMES) {
      problems.push(
        `You can add at most ${BULK_MAX_NAMES} names at once; there are ${this.totalNames()}.`,
      );
    }
    for (const card of this.cards()) {
      const raw = card.getRawValue();
      for (const name of [raw.name.trim(), ...overLongNames(parseNames(raw.subcategories))]) {
        if (name.length > BULK_MAX_NAME_LENGTH) {
          problems.push(`"${preview(name)}" is longer than ${BULK_MAX_NAME_LENGTH} characters.`);
        }
      }
    }
    return problems;
  });

  /** Warns as a limit gets close, before it is exceeded. */
  readonly nearLimit: Signal<string | null> = computed((): string | null => {
    if (this.problems().length > 0) return null;
    if (this.parentCount() >= BULK_MAX_GROUPS * 0.8) {
      return `Close to the limit of ${BULK_MAX_GROUPS} parents at once.`;
    }
    if (this.totalNames() >= BULK_MAX_NAMES * 0.8) {
      return `Close to the limit of ${BULK_MAX_NAMES} names at once.`;
    }
    return null;
  });

  readonly canSubmit: Signal<boolean> = computed(
    (): boolean =>
      this.problems().length === 0 &&
      this.summaries().every((s: GroupSummary): boolean => !s.nameMissing) &&
      !this.saving(),
  );

  readonly summaryText: Signal<string> = computed((): string => {
    const parents = `${this.parentCount()} ${this.parentCount() === 1 ? 'parent' : 'parents'}`;
    const subs = `${this.subcategoryTotal()} ${this.subcategoryTotal() === 1 ? 'subcategory' : 'subcategories'}`;
    return `${categoryCount(this.totalNames())} to create: ${parents} and ${subs}`;
  });

  readonly skippedReasonText = (reason: string | undefined): string => reason || 'Skipped';

  constructor() {
    afterNextRender((): void => this.focusFirstField(), { injector: this.injector });
  }

  private newGroup(): GroupForm {
    return new FormGroup({
      name: new FormControl<string>('', { nonNullable: true }),
      type: new FormControl<CategoryType>(CategoryType.EXPENSE, { nonNullable: true }),
      color: new FormControl<string>(CATEGORY_COLORS[0], { nonNullable: true }),
      icon: new FormControl<string>('', { nonNullable: true }),
      subcategories: new FormControl<string>('', { nonNullable: true }),
    });
  }

  addGroup(): void {
    this.groups.push(this.newGroup());
    this.cards.set([...this.groups.controls]);
    this.form.markAsDirty();
    afterNextRender(
      (): void => {
        const names =
          this.host.nativeElement.querySelectorAll<HTMLElement>('input[id^="bulk-name-"]');
        names[names.length - 1]?.focus();
      },
      { injector: this.injector },
    );
  }

  removeGroup(index: number): void {
    if (index === 0 || index >= this.groups.length) return;
    this.groups.removeAt(index);
    this.cards.set([...this.groups.controls]);
    this.form.markAsDirty();
  }

  selectColor(card: GroupForm, color: string): void {
    card.controls.color.setValue(card.controls.color.value === color ? '' : color);
    card.controls.color.markAsDirty();
  }

  selectIcon(card: GroupForm, icon: string): void {
    card.controls.icon.setValue(card.controls.icon.value === icon ? '' : icon);
    card.controls.icon.markAsDirty();
  }

  iconLabel(icon: string): string {
    return icon.replace(/^pi-/, '').replace(/-/g, ' ');
  }

  /** Submits from outside (the panel's Create button). */
  submit(): void {
    if (!this.canSubmit()) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit({
      groups: this.cards().map((card: GroupForm): CategoryBatchGroup => {
        const raw = card.getRawValue();
        const name: string = raw.name.trim();
        return {
          name,
          type: raw.type,
          color: raw.color || getCategoryColor(name),
          icon: raw.icon || undefined,
          subcategories: parseNames(raw.subcategories),
        };
      }),
    });
  }

  private focusFirstField(): void {
    this.host.nativeElement.querySelector<HTMLElement>('input[id^="bulk-name-"]')?.focus();
  }
}
