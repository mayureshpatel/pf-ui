import {Component, computed, DestroyRef, inject, OnInit, Signal, signal, WritableSignal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {CommonModule} from '@angular/common';
import {finalize} from 'rxjs';
import {ButtonModule} from 'primeng/button';
import {TableModule} from 'primeng/table';
import {CardModule} from 'primeng/card';
import {ConfirmationService} from 'primeng/api';
import {TooltipModule} from 'primeng/tooltip';

import {Tag} from '@models/tag.model';
import {TagApiService} from '@features/tags/services/tag-api.service';
import {ToastService} from '@core/services/toast.service';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';
import {TagFormDialogComponent} from './components/tag-form-dialog/tag-form-dialog.component';

/**
 * Dedicated tag management page (PF-309): lists the user's tags and lets them create, rename,
 * recolor, and delete tag definitions directly, rather than only ever touching them from inside a
 * transaction (PF-308's own scope).
 */
@Component({
  selector: 'app-tags',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    CardModule,
    TooltipModule,
    ScreenToolbarComponent,
    TagFormDialogComponent
  ],
  templateUrl: './tags.component.html'
})
export class TagsComponent implements OnInit {
  private readonly api: TagApiService = inject(TagApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly confirmationService: ConfirmationService = inject(ConfirmationService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** The user's tags. */
  readonly tags: WritableSignal<Tag[]> = signal([]);

  /** Global loading state for API operations. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Visibility of the create/edit dialog. */
  readonly showDialog: WritableSignal<boolean> = signal(false);

  /** The tag being edited, or `null` when the dialog is in create mode. */
  readonly selectedTag: WritableSignal<Tag | null> = signal(null);

  /** Indicates if no tags have been defined yet. */
  readonly isEmpty: Signal<boolean> = computed((): boolean => this.tags().length === 0 && !this.loading());

  ngOnInit(): void {
    this.loadTags();
  }

  /**
   * Fetches the current tag list from the API.
   */
  loadTags(): void {
    this.loading.set(true);
    this.api.getTags()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.loading.set(false))
      )
      .subscribe({
        next: (data: Tag[]): void => this.tags.set(data),
        error: (err: any): void => {
          console.error('Failed to load tags:', err);
          this.toast.error('Failed to load tags.');
        }
      });
  }

  /**
   * Opens the dialog in create mode.
   */
  openCreateDialog(): void {
    this.selectedTag.set(null);
    this.showDialog.set(true);
  }

  /**
   * Opens the dialog pre-filled for editing an existing tag.
   * @param tag the tag to edit
   */
  openEditDialog(tag: Tag): void {
    this.selectedTag.set(tag);
    this.showDialog.set(true);
  }

  /**
   * Refreshes the list after a tag is created or updated.
   */
  onTagSaved(): void {
    this.loadTags();
  }

  /**
   * Deletes a tag after confirmation, making clear that it also removes the tag from any
   * transactions currently carrying it (the backend cascades the transaction_tags rows).
   * @param tag the tag to delete
   */
  deleteTag(tag: Tag): void {
    this.confirmationService.confirm({
      header: 'Delete Tag?',
      message: `Are you sure you want to delete "${tag.name}"? This also removes it from any transactions currently tagged with it.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: (): void => {
        this.api.deleteTag(tag.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (): void => {
              this.toast.success('Tag deleted.');
              this.tags.update((list: Tag[]): Tag[] => list.filter((t: Tag): boolean => t.id !== tag.id));
            },
            error: (err: any): void => {
              console.error('Delete failed:', err);
              this.toast.error('Failed to delete tag.');
            }
          });
      }
    });
  }
}
