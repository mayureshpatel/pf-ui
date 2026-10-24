import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  Signal,
  signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize, forkJoin, Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService } from 'primeng/api';

import { Category, CategoryCreateRequest, CategoryUpdateRequest } from '@models/category.model';
import { CategoryApiService } from './services/category-api.service';
import { TransactionApiService } from '@features/transactions/services/transaction-api.service';
import { ToastService } from '@core/services/toast.service';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { CategoryFiltersComponent } from './components/category-filters/category-filters.component';
import { CategoryTreeComponent } from './components/category-tree/category-tree.component';
import { CategoryOverviewComponent } from './components/category-overview/category-overview.component';
import { CategoryEditFormComponent } from './components/category-edit-form/category-edit-form.component';
import {
  availableTypes,
  buildNodes,
  CategoryFilter,
  CategoryNode,
  CategoryStats,
  categoryStats,
  filterNodes,
  isFiltering,
  isTickable,
  isUnused,
  NO_FILTER,
} from './utils/category-helpers';

/** What the docked panel is showing. */
export type CategoryPanelMode = 'overview' | 'category' | 'add' | 'selection';

/**
 * The Categories page: a filterable tree of categories beside an always-present panel. The panel
 * shows an overview by default, an editor for the selected category, the add form, or the
 * categories ticked for deletion.
 */
@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ScreenToolbarComponent,
    PageErrorStateComponent,
    SidePanelComponent,
    CategoryFiltersComponent,
    CategoryTreeComponent,
    CategoryOverviewComponent,
    CategoryEditFormComponent,
  ],
  templateUrl: './categories.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesComponent implements OnInit {
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly transactionApi: TransactionApiService = inject(TransactionApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly router: Router = inject(Router);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** Every category, flat, each carrying its own transaction count. */
  readonly categories: WritableSignal<Category[]> = signal([]);
  readonly loading: WritableSignal<boolean> = signal(false);
  readonly loadError: WritableSignal<boolean> = signal(false);
  /** True once a load has succeeded; later reloads dim the tree instead of replacing the page. */
  readonly loadedOnce: WritableSignal<boolean> = signal(false);
  /** A save, add or delete is in flight. */
  readonly saving: WritableSignal<boolean> = signal(false);

  readonly filter: WritableSignal<CategoryFilter> = signal(NO_FILTER);
  readonly expandedIds: WritableSignal<ReadonlySet<number>> = signal(new Set<number>());
  readonly tickedIds: WritableSignal<ReadonlySet<number>> = signal(new Set<number>());

  readonly panelMode: WritableSignal<CategoryPanelMode> = signal('overview');
  readonly selectedCategoryId: WritableSignal<number | null> = signal(null);
  /** The parent to pre-select when adding from a parent's panel. */
  readonly addParentId: WritableSignal<number | null> = signal(null);

  readonly nodes: Signal<CategoryNode[]> = computed((): CategoryNode[] =>
    buildNodes(this.categories(), this.categories()),
  );
  readonly visibleNodes: Signal<CategoryNode[]> = computed((): CategoryNode[] =>
    filterNodes(this.nodes(), this.filter()),
  );
  readonly filtering: Signal<boolean> = computed((): boolean => isFiltering(this.filter()));
  readonly stats: Signal<CategoryStats> = computed((): CategoryStats =>
    categoryStats(this.categories()),
  );
  readonly types = computed(() => availableTypes(this.categories()));

  /** While filtering, every parent that has a visible child is shown expanded. */
  readonly expandedForTree: Signal<ReadonlySet<number>> = computed((): ReadonlySet<number> =>
    this.filtering()
      ? new Set<number>(
          this.visibleNodes()
            .filter((n: CategoryNode): boolean => n.children.length > 0)
            .map((n: CategoryNode): number => n.parent.id),
        )
      : this.expandedIds(),
  );

  /** Checkboxes show while the Unused pill is on. */
  readonly showChecks: Signal<boolean> = computed((): boolean => this.filter().unusedOnly);
  readonly tickableIds: Signal<ReadonlySet<number>> = computed((): ReadonlySet<number> => {
    const ticked: ReadonlySet<number> = this.tickedIds();
    const ids = new Set<number>();
    for (const node of this.visibleNodes()) {
      for (const category of [node.parent, ...node.children]) {
        if (isTickable(category, this.nodes(), ticked)) ids.add(category.id);
      }
    }
    return ids;
  });

  readonly selectedCategory: Signal<Category | null> = computed(
    (): Category | null =>
      this.categories().find((c: Category): boolean => c.id === this.selectedCategoryId()) ?? null,
  );
  readonly selectedCategories: Signal<Category[]> = computed((): Category[] =>
    this.categories().filter((c: Category): boolean => this.tickedIds().has(c.id)),
  );

  /** With no categories the add form is the only useful mode, so it has no Back or Close. */
  readonly onlyAddMode: Signal<boolean> = computed(
    (): boolean => this.categories().length === 0 && !this.loading() && this.panelMode() === 'add',
  );
  private readonly isEmpty: Signal<boolean> = computed(
    (): boolean =>
      this.loadedOnce() && this.categories().length === 0 && !this.loading() && !this.loadError(),
  );

  readonly panelTitle: Signal<string> = computed((): string => {
    switch (this.panelMode()) {
      case 'add':
        return 'Add category';
      case 'category':
        return this.selectedCategory()?.name ?? 'Category';
      case 'selection':
        return `${this.tickedIds().size} selected`;
      default:
        return 'Overview';
    }
  });

  /** Why the selected category cannot be deleted, or null when it can. */
  readonly deleteBlockedReason: Signal<string | null> = computed((): string | null => {
    const category: Category | null = this.selectedCategory();
    if (!category) return null;
    const count: number = category.transactionCount ?? 0;
    if (count > 0) return `It has ${count} ${count === 1 ? 'transaction' : 'transactions'}.`;
    if (this.categories().some((c: Category): boolean => c.parent?.id === category.id)) {
      return 'Move or delete its subcategories first.';
    }
    return null;
  });

  private loadSubscription: Subscription | null = null;
  private readonly editForm = viewChild<CategoryEditFormComponent>('editForm');

  constructor() {
    effect((): void => {
      if (this.isEmpty() && this.panelMode() !== 'add') {
        untracked((): void => this.panelMode.set('add'));
      }
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  /** Loads the categories and their transaction counts; a newer load replaces an older one. */
  loadData(): void {
    this.loadSubscription?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(false);
    this.loadSubscription = forkJoin({
      categories: this.categoryApi.getCategories(),
      counts: this.transactionApi.getCountsByCategory(),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false)),
      )
      .subscribe({
        next: ({ categories, counts }): void => {
          const nodes: CategoryNode[] = buildNodes(categories, counts);
          this.categories.set(
            nodes.flatMap((n: CategoryNode): Category[] => [n.parent, ...n.children]),
          );
          this.loadedOnce.set(true);
          this.pruneTicks();
          this.closePanelIfCategoryGone();
        },
        error: (err: unknown): void => {
          console.error('Failed to load category data:', err);
          this.toast.error('Failed to load categories');
          this.categories.set([]);
          this.loadError.set(true);
        },
      });
  }

  setFilter(filter: CategoryFilter): void {
    this.filter.set(filter);
    this.pruneTicks();
    if (this.panelMode() === 'selection' && this.tickedIds().size === 0) {
      this.closePanel();
    }
  }

  clearFilters(): void {
    this.setFilter(NO_FILTER);
  }

  toggleExpand(id: number): void {
    const next = new Set<number>(this.expandedIds());
    if (!next.delete(id)) next.add(id);
    this.expandedIds.set(next);
  }

  expandAll(): void {
    this.expandedIds.set(
      new Set<number>(
        this.nodes()
          .filter((n: CategoryNode): boolean => n.children.length > 0)
          .map((n: CategoryNode): number => n.parent.id),
      ),
    );
  }

  collapseAll(): void {
    this.expandedIds.set(new Set<number>());
  }

  /** Ticks or unticks a row (Unused pill on); the first tick opens selection mode. */
  toggleTick(id: number): void {
    const isTicked: boolean = this.tickedIds().has(id);
    if (!isTicked && !this.tickableIds().has(id)) return;
    this.confirmDiscardIfDirty((): void => {
      const next = new Set<number>(this.tickedIds());
      if (isTicked) next.delete(id);
      else next.add(id);
      this.tickedIds.set(next);
      this.pruneTicks();
      if (this.tickedIds().size === 0) {
        this.closePanel();
      } else {
        this.selectedCategoryId.set(null);
        this.go('selection');
      }
    });
  }

  /** Shows a category in the panel. */
  openCategory(category: Category): void {
    if (this.panelMode() === 'category' && this.selectedCategoryId() === category.id) return;
    this.confirmDiscardIfDirty((): void => {
      this.selectedCategoryId.set(category.id);
      this.go('category');
    });
  }

  /** Opens the add form; from a parent's panel (`parentId`) that parent is pre-selected. */
  startAdd(parentId?: number): void {
    if (this.panelMode() === 'add' && this.addParentId() === (parentId ?? null)) return;
    this.confirmDiscardIfDirty((): void => {
      this.addParentId.set(parentId ?? null);
      if (parentId === undefined) this.selectedCategoryId.set(null);
      this.go('add');
    });
  }

  /** Back: add returns to the category it came from, everything else to the overview. */
  back(): void {
    const mode: CategoryPanelMode = this.panelMode();
    if (mode === 'overview') return;
    this.confirmDiscardIfDirty((): void => {
      if (mode === 'add' && this.selectedCategoryId() !== null) {
        this.go('category');
      } else {
        this.clearTicksIfSelecting();
        this.closePanel();
      }
    });
  }

  /** Returns to the overview with nothing selected, without asking. */
  closePanel(): void {
    this.selectedCategoryId.set(null);
    this.go('overview');
  }

  /** Close button and Escape: asks first when there are unsaved edits; the overview ignores them. */
  onPanelClose(): void {
    if (this.panelMode() === 'overview' || this.onlyAddMode()) return;
    this.confirmDiscardIfDirty((): void => {
      this.clearTicksIfSelecting();
      this.closePanel();
    });
  }

  /** The panel's Save button: submits the form that is showing. */
  onPanelSave(): void {
    this.editForm()?.submit();
  }

  /** Saves the form: an update when a category is open, otherwise a create. */
  saveCategory(request: CategoryCreateRequest | CategoryUpdateRequest): void {
    if (this.saving() || this.loading()) return;
    this.saving.set(true);
    if ('id' in request) {
      this.categoryApi
        .updateCategory(request.id, request)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize((): void => this.saving.set(false)),
        )
        .subscribe({
          next: (): void => {
            this.toast.success('Category updated');
            this.editForm()?.form.markAsPristine();
            this.loadData();
          },
          error: (error: HttpErrorResponse): void => this.saveFailed(error),
        });
      return;
    }
    this.categoryApi
      .createCategory(request)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (newId: number): void => {
          this.toast.success('Category added');
          this.editForm()?.form.markAsPristine();
          if (request.parentId !== undefined) {
            this.expandedIds.set(new Set<number>(this.expandedIds()).add(request.parentId));
          }
          this.selectedCategoryId.set(newId);
          this.go('category');
          this.loadData();
        },
        error: (error: HttpErrorResponse): void => this.saveFailed(error),
      });
  }

  /** Confirms, then deletes a category (the selected one by default). */
  deleteCategory(category: Category | null = this.selectedCategory()): void {
    if (!category || this.deleteBlockedReason() !== null || this.saving() || this.loading()) return;
    this.confirmationService.confirm({
      header: 'Delete category?',
      message: `Delete the ${category.name} category?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        if (this.saving()) return;
        this.saving.set(true);
        this.categoryApi
          .deleteCategory(category.id)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize((): void => this.saving.set(false)),
          )
          .subscribe({
            next: (): void => {
              this.toast.success('Category deleted');
              this.closePanel();
              this.loadData();
            },
            error: (error: HttpErrorResponse): void => {
              console.error('Error deleting category:', error);
              this.toast.error(error.error?.detail || 'Failed to delete category');
            },
          });
      },
    });
  }

  /** Opens Transactions for a category across all time (the selected one by default). */
  viewTransactions(category: Category | null = this.selectedCategory()): void {
    if (!category) return;
    this.confirmDiscardIfDirty((): void => {
      void this.router.navigate(['/transactions'], {
        queryParams: { categoryName: category.name, period: 'all' },
      });
    });
  }

  private go(mode: CategoryPanelMode): void {
    this.panelMode.set(mode);
  }

  private saveFailed(error: HttpErrorResponse): void {
    console.error('Error saving category:', error);
    this.toast.error(error.error?.detail || 'Failed to save category');
  }

  private clearTicksIfSelecting(): void {
    if (this.panelMode() === 'selection') this.tickedIds.set(new Set<number>());
  }

  /** Drops ticks that are gone, hidden by the filters, or no longer allowed. */
  private pruneTicks(): void {
    if (!this.filter().unusedOnly) {
      if (this.tickedIds().size > 0) this.tickedIds.set(new Set<number>());
      return;
    }
    const visible = new Set<number>(
      this.visibleNodes().flatMap((n: CategoryNode): number[] => [
        n.parent.id,
        ...n.children.map((c: Category): number => c.id),
      ]),
    );
    let next = new Set<number>(
      [...this.tickedIds()].filter((id: number): boolean => visible.has(id)),
    );
    // a parent stays ticked only while every subcategory is ticked and it is still unused
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...next]) {
        const category: Category | undefined = this.categories().find((c: Category) => c.id === id);
        if (!category || !isUnused(category) || !isTickable(category, this.nodes(), next)) {
          next = new Set<number>([...next].filter((other: number): boolean => other !== id));
          changed = true;
        }
      }
    }
    this.tickedIds.set(next);
  }

  /** A reload that no longer contains the shown category (deleted elsewhere) closes the panel. */
  private closePanelIfCategoryGone(): void {
    const id: number | null = this.selectedCategoryId();
    if (this.panelMode() !== 'category' || id === null) return;
    if (this.categories().some((c: Category): boolean => c.id === id)) return;
    this.closePanel();
    this.toast.error('That category no longer exists.');
  }

  /** Runs an action that would replace a form, after asking when that form has unsaved changes. */
  private confirmDiscardIfDirty(proceed: () => void): void {
    const mode: CategoryPanelMode = this.panelMode();
    const dirty: boolean = (mode === 'category' || mode === 'add') && !!this.editForm()?.form.dirty;
    if (!dirty) {
      proceed();
      return;
    }
    this.confirmationService.confirm({
      header: 'Discard changes?',
      message: 'You have unsaved changes. Discard them?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep editing',
      acceptButtonStyleClass: 'p-button-danger',
      accept: proceed,
    });
  }
}
