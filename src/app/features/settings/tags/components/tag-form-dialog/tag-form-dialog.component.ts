import {
  Component,
  computed,
  effect,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  output,
  OutputEmitterRef,
  Signal,
  signal,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {ColorPickerModule} from 'primeng/colorpicker';
import {MessageModule} from 'primeng/message';

import {Tag} from '@models/tag.model';
import {TagApiService} from '@features/tags/services/tag-api.service';
import {AuthService} from '@core/auth/auth.service';
import {ToastService} from '@core/services/toast.service';

const DEFAULT_COLOR = '3b82f6';

/**
 * Create/edit dialog for a tag definition (PF-309). A 2-field form (name + color) -- per
 * PF-EPIC-037's decided modal-pattern rule (7+ fields -> drawer, 6 or fewer -> dialog), this is a
 * dialog, matching {@link MerchantFormDialogComponent}'s structure. Unlike that dialog, this one
 * is bimodal: a null `tag` input means "create," a real one means "edit," mirroring
 * `TransactionFormDrawerComponent`'s own create/edit split.
 *
 * PrimeNG's `p-colorPicker` model value is a bare hex string with no leading `#` (e.g. "3b82f6"),
 * but `Tag.color` is stored and consumed everywhere else in the app (transaction row pills, this
 * page's own swatch) as a CSS-ready value with the `#` -- so it's stripped on load and re-added on
 * save rather than changing the stored format to match the picker.
 */
@Component({
  selector: 'app-tag-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    ColorPickerModule,
    MessageModule
  ],
  templateUrl: './tag-form-dialog.component.html'
})
export class TagFormDialogComponent {
  private readonly tagApi: TagApiService = inject(TagApiService);
  private readonly authService: AuthService = inject(AuthService);
  private readonly toast: ToastService = inject(ToastService);

  /** Two-way binding for the dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The tag being edited, or `null` when creating a new one. */
  readonly tag: InputSignal<Tag | null> = input<Tag | null>(null);

  /** Emitted once the tag has been created or updated successfully. */
  readonly save: OutputEmitterRef<void> = output<void>();

  /** Indicates if a save operation is in progress. */
  readonly saving: WritableSignal<boolean> = signal(false);

  /** Holds API error messages for display. */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /** Whether this dialog instance is editing an existing tag rather than creating a new one. */
  readonly isEditMode: Signal<boolean> = computed((): boolean => this.tag() !== null);

  readonly dialogTitle: Signal<string> = computed((): string => this.isEditMode() ? 'Edit Tag' : 'New Tag');

  /**
   * Reactive form for the tag's name and color. `color` holds a bare hex string (no `#`), matching
   * `p-colorPicker`'s own value format.
   */
  readonly form = new FormGroup({
    name: new FormControl<string>('', {nonNullable: true, validators: [Validators.required]}),
    color: new FormControl<string>(DEFAULT_COLOR, {nonNullable: true})
  });

  constructor() {
    /**
     * Resets and pre-fills the form whenever the dialog opens for a (possibly different) tag, or
     * clears it for a new one.
     */
    effect((): void => {
      if (this.visible()) {
        const existing: Tag | null = this.tag();
        this.form.reset({
          name: existing?.name ?? '',
          color: existing?.color ? existing.color.replace('#', '') : DEFAULT_COLOR
        });
        this.errorMessage.set(null);
      }
    });
  }

  /**
   * Closes the dialog.
   */
  onHide(): void {
    this.visible.set(false);
  }

  /**
   * Validates and submits the tag to the API, creating or updating depending on whether an
   * existing tag was passed in.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) {
      return;
    }

    const rawValue = this.form.getRawValue();
    const color = `#${rawValue.color}`;
    const existing: Tag | null = this.tag();

    this.saving.set(true);
    this.errorMessage.set(null);

    const op = existing
      ? this.tagApi.updateTag({id: existing.id, name: rawValue.name, color})
      : this.tagApi.createTag({userId: this.authService.user()?.id ?? 0, name: rawValue.name, color});

    op.pipe(finalize((): void => this.saving.set(false)))
      .subscribe({
        next: (): void => {
          this.toast.success(`Tag ${existing ? 'updated' : 'created'}`);
          this.save.emit();
          this.onHide();
        },
        error: (err: any): void => {
          console.error('Error saving tag:', err);
          this.errorMessage.set(err.error?.detail || 'Failed to save tag. Please try again.');
        }
      });
  }
}
