import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  OnInit,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@core/services/toast.service';
import { TagApiService } from '@features/tags/services/tag-api.service';
import { Tag } from '@models/tag.model';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { SidePanelComponent } from '@shared/components/side-panel/side-panel.component';
import { SettingsGuard } from '../settings.guard';
import { filterTags, sortTags, tagTransactionsQuery } from '../utils/settings-helpers';
import {
  TagCreateValue,
  TagEditFormComponent,
  TagUpdateValue,
} from './components/tag-edit-form/tag-edit-form.component';

type TagPanelMode = 'overview' | 'tag' | 'add';
const DEFAULT_TAG_COLOR = '#94a3b8';

/**
 * The Tags section: the tags sorted by name beside an always-present panel (overview, the selected tag,
 * add). Tags label transactions independently of category. Owns loading, the discard prompt, saving,
 * deleting and the link to a tag's transactions.
 */
@Component({
  selector: 'app-tags',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ScreenToolbarComponent,
    SidePanelComponent,
    TagEditFormComponent,
    PageErrorStateComponent,
  ],
  templateUrl: './tags.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagsComponent implements OnInit {
  private readonly api: TagApiService = inject(TagApiService);
  private readonly auth: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);
  private readonly injector: Injector = inject(Injector);
  private readonly guard: SettingsGuard | null = inject(SettingsGuard, { optional: true });

  protected readonly tags: WritableSignal<Tag[]> = signal([]);
  protected readonly loading: WritableSignal<boolean> = signal(false);
  protected readonly loadError: WritableSignal<boolean> = signal(false);
  /** First-load skeleton only; later reloads dim the list and keep the panel mounted. */
  protected readonly loadedOnce: WritableSignal<boolean> = signal(false);
  protected readonly saving: WritableSignal<boolean> = signal(false);
  protected readonly search: WritableSignal<string> = signal('');
  protected readonly panelMode: WritableSignal<TagPanelMode> = signal('overview');
  protected readonly selectedTagId: WritableSignal<number | null> = signal(null);

  protected readonly visibleTags: Signal<Tag[]> = computed((): Tag[] =>
    sortTags(filterTags(this.tags(), this.search())),
  );
  protected readonly selectedTag: Signal<Tag | null> = computed(
    (): Tag | null => this.tags().find((t: Tag): boolean => t.id === this.selectedTagId()) ?? null,
  );
  /** With no tags the add form is the only useful mode, so it has no Back or Close. */
  protected readonly onlyAddMode: Signal<boolean> = computed(
    (): boolean =>
      this.loadedOnce() &&
      this.tags().length === 0 &&
      !this.loading() &&
      !this.loadError() &&
      this.panelMode() === 'add',
  );
  protected readonly panelTitle: Signal<string> = computed((): string => {
    switch (this.panelMode()) {
      case 'add':
        return 'Add tag';
      case 'tag':
        return this.selectedTag()?.name ?? 'Tag';
      default:
        return 'Overview';
    }
  });

  private readonly panel = viewChild(SidePanelComponent);
  protected readonly tagForm = viewChild<TagEditFormComponent>('tagForm');
  private loadSubscription: Subscription | null = null;
  private loadRun = 0;
  /** The element that had focus when the panel left the overview, to hand focus back to. */
  private focusReturn: HTMLElement | null = null;

  private readonly isDirty = (): boolean =>
    this.panelMode() !== 'overview' && !!this.tagForm()?.form.dirty;

  constructor() {
    this.guard?.register(this.isDirty);
    this.destroyRef.onDestroy((): void => this.guard?.unregister(this.isDirty));
  }

  ngOnInit(): void {
    this.loadTags();
  }

  readonly color = (tag: Tag): string => tag.color || DEFAULT_TAG_COLOR;

  // ---- loading ----

  /** Loads the tags; a newer load replaces an older one. `afterLoad` runs once they have arrived. */
  loadTags(afterLoad?: () => void): void {
    this.loadSubscription?.unsubscribe();
    const run: number = ++this.loadRun;
    this.loading.set(true);
    this.loadError.set(false);
    this.loadSubscription = this.api
      .getTags()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => {
          if (run === this.loadRun) this.loading.set(false);
        }),
      )
      .subscribe({
        next: (data: Tag[]): void => {
          this.tags.set(data);
          this.loadedOnce.set(true);
          this.afterTagsLoaded(data);
          afterLoad?.();
        },
        error: (err: unknown): void => {
          console.error('Failed to load tags:', err);
          this.toast.error('Failed to load tags.');
          this.tags.set([]);
          this.loadError.set(true);
        },
      });
  }

  private afterTagsLoaded(data: Tag[]): void {
    if (data.length === 0) {
      this.selectedTagId.set(null);
      this.panelMode.set('add');
      return;
    }
    if (this.panelMode() === 'tag' && !data.some((t: Tag) => t.id === this.selectedTagId())) {
      this.toast.info('That tag no longer exists.');
      this.closePanel();
    }
  }

  // ---- panel ----

  openTag(tag: Tag): void {
    if (this.panelMode() === 'tag' && this.selectedTagId() === tag.id) return;
    this.confirmDiscardIfDirty((): void => {
      this.selectedTagId.set(tag.id);
      this.go('tag');
    });
  }

  startAdd(): void {
    if (this.panelMode() === 'add') return;
    this.confirmDiscardIfDirty((): void => {
      this.selectedTagId.set(null);
      this.go('add');
    });
  }

  back(): void {
    if (this.panelMode() === 'overview') return;
    this.confirmDiscardIfDirty((): void => this.closePanel());
  }

  closePanel(): void {
    this.selectedTagId.set(null);
    this.go('overview');
  }

  /** Close button and Escape: asks first when there are unsaved edits; the overview ignores them. */
  onPanelClose(): void {
    if (this.panelMode() === 'overview' || this.onlyAddMode()) return;
    this.back();
  }

  /** The panel's Save button: submits the form that is showing. */
  onPanelSave(): void {
    this.tagForm()?.submit();
  }

  clearSearch(): void {
    this.search.set('');
  }

  /** Opens the transactions carrying the open tag, across all time. */
  viewTransactions(): void {
    const tag: Tag | null = this.selectedTag();
    if (tag) {
      void this.router.navigate(['/transactions'], { queryParams: tagTransactionsQuery(tag) });
    }
  }

  // ---- saving and deleting ----

  /** Saves the form: an update when a tag is open, otherwise a create. */
  saveTag(request: TagCreateValue | TagUpdateValue): void {
    if (this.saving()) return;
    this.saving.set(true);
    const editing: boolean = 'id' in request;
    const call =
      'id' in request
        ? this.api.updateTag(request)
        : this.api.createTag({ userId: this.auth.user()?.id ?? 0, ...request });
    call
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (created: number | null | undefined): void => {
          // an update answers with no id, so the open tag's own id stays selected
          const id: number = 'id' in request ? request.id : (created as number);
          this.tagForm()?.form.markAsPristine();
          this.toast.success(editing ? 'Tag saved' : 'Tag added');
          this.loadTags((): void => {
            this.selectedTagId.set(id);
            this.go('tag');
          });
        },
        error: (err: HttpErrorResponse): void => {
          console.error('Saving the tag failed:', err);
          this.tagForm()?.errorMessage.set(err.error?.detail || 'Failed to save the tag.');
        },
      });
  }

  /** Asks, then deletes the open tag. */
  deleteSelected(): void {
    const tag: Tag | null = this.selectedTag();
    if (!tag) return;
    this.confirmationService.confirm({
      header: 'Delete tag?',
      message: `Delete the ${tag.name} tag? It is also removed from any transactions that carry it.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => this.performDelete(tag),
    });
  }

  private performDelete(tag: Tag): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.api
      .deleteTag(tag.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.saving.set(false)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Tag deleted');
          this.tagForm()?.form.markAsPristine();
          this.closePanel();
          this.loadTags();
        },
        error: (err: HttpErrorResponse): void => {
          console.error('Delete failed:', err);
          this.toast.error(err.error?.detail || 'Failed to delete tag.');
        },
      });
  }

  // ---- internals ----

  /** Runs an action that would replace a form, after asking when that form has unsaved changes. */
  private confirmDiscardIfDirty(proceed: () => void): void {
    if (!this.isDirty()) {
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

  /** Switches mode and moves focus: into the panel for any step, back to the opener for overview. */
  private go(mode: TagPanelMode): void {
    if (mode === 'overview' && this.panelMode() === 'overview') return;
    if (this.panelMode() === 'overview' && mode !== 'overview') {
      this.focusReturn = document.activeElement as HTMLElement | null;
    }
    this.panelMode.set(mode);
    afterNextRender(
      (): void => {
        const target: HTMLElement | null = this.focusReturn;
        if (mode === 'overview' && target?.isConnected) {
          target.focus();
        } else {
          this.panel()?.focus();
        }
        if (mode === 'overview') this.focusReturn = null;
      },
      { injector: this.injector },
    );
  }
}
