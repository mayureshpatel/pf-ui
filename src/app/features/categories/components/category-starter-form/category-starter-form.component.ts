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
import { CategoryBatchGroup, CategoryBatchRequest } from '@models/category.model';
import { categoryCount } from '../../utils/category-bulk';
import { STARTER_CATEGORIES, StarterParent } from '../../utils/starter-categories';

/** One parent row of the checklist, worked out from what is ticked. */
interface ParentRow {
  parent: StarterParent;
  ticked: boolean;
  /** Parent ticked with some, but not all, subcategories ticked. */
  indeterminate: boolean;
  tickedChildren: boolean[];
  tickedCount: number;
}

/** The panel's starter mode: a checklist of suggested parents and subcategories, all ticked. */
@Component({
  selector: 'app-category-starter-form',
  standalone: true,
  templateUrl: './category-starter-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryStarterFormComponent {
  readonly saving: InputSignal<boolean> = input<boolean>(false);
  /** The error from a failed request (nothing was created), shown above the count. */
  readonly errorMessage: InputSignal<string | null> = input<string | null>(null);
  readonly save: OutputEmitterRef<CategoryBatchRequest> = output<CategoryBatchRequest>();

  readonly starter: readonly StarterParent[] = STARTER_CATEGORIES;
  readonly categoryCount = categoryCount;

  /** Ticked items: "p<parent>" for a parent, "c<parent>.<child>" for a subcategory. */
  private readonly ticked: WritableSignal<ReadonlySet<string>> = signal(this.everything());
  /** Whether the selection differs from the default, so closing asks first. */
  readonly dirty: WritableSignal<boolean> = signal(false);

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef<HTMLElement>);
  private readonly injector: Injector = inject(Injector);

  readonly rows: Signal<ParentRow[]> = computed((): ParentRow[] =>
    this.starter.map((parent: StarterParent, p: number): ParentRow => {
      const tickedChildren: boolean[] = parent.subcategories.map((_: string, c: number): boolean =>
        this.ticked().has(`c${p}.${c}`),
      );
      const tickedCount: number = tickedChildren.filter(Boolean).length;
      const ticked: boolean = this.ticked().has(`p${p}`);
      return {
        parent,
        ticked,
        indeterminate: ticked && tickedCount > 0 && tickedCount < tickedChildren.length,
        tickedChildren,
        tickedCount,
      };
    }),
  );

  readonly selectedCount: Signal<number> = computed((): number => this.ticked().size);
  readonly canSubmit: Signal<boolean> = computed(
    (): boolean => this.selectedCount() > 0 && !this.saving(),
  );

  constructor() {
    afterNextRender(
      (): void => this.host.nativeElement.querySelector<HTMLElement>('input')?.focus(),
      { injector: this.injector },
    );
  }

  /** Ticks a parent with all its subcategories, or clears it when it is already fully ticked or bare. */
  toggleParent(p: number): void {
    const row: ParentRow = this.rows()[p];
    const next = new Set<string>(this.ticked());
    const clear: boolean = row.ticked && (row.tickedCount === 0 || !row.indeterminate);
    next.delete(`p${p}`);
    row.parent.subcategories.forEach(
      (_: string, c: number): void => void next.delete(`c${p}.${c}`),
    );
    if (!clear) {
      next.add(`p${p}`);
      row.parent.subcategories.forEach((_: string, c: number): void => void next.add(`c${p}.${c}`));
    }
    this.update(next);
  }

  /** Ticking a subcategory ticks its parent; unticking leaves the parent as it is. */
  toggleChild(p: number, c: number): void {
    const next = new Set<string>(this.ticked());
    if (next.delete(`c${p}.${c}`)) {
      // the parent stays ticked: it is then created without this subcategory
    } else {
      next.add(`c${p}.${c}`);
      next.add(`p${p}`);
    }
    this.update(next);
  }

  selectAll(): void {
    this.update(this.everything());
  }

  selectNone(): void {
    this.update(new Set<string>());
  }

  /** Submits from outside (the panel's Add selected button). */
  submit(): void {
    if (!this.canSubmit()) return;
    this.save.emit({
      groups: this.rows()
        .filter((row: ParentRow): boolean => row.ticked)
        .map((row: ParentRow): CategoryBatchGroup => ({
          name: row.parent.name,
          type: row.parent.type,
          color: row.parent.color,
          icon: row.parent.icon,
          subcategories: row.parent.subcategories.filter(
            (_: string, c: number): boolean => row.tickedChildren[c],
          ),
        })),
    });
  }

  markPristine(): void {
    this.dirty.set(false);
  }

  private update(next: ReadonlySet<string>): void {
    this.ticked.set(next);
    this.dirty.set(true);
  }

  private everything(): ReadonlySet<string> {
    const all = new Set<string>();
    STARTER_CATEGORIES.forEach((parent: StarterParent, p: number): void => {
      all.add(`p${p}`);
      parent.subcategories.forEach((_: string, c: number): void => void all.add(`c${p}.${c}`));
    });
    return all;
  }
}
