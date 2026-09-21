import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  InputSignal,
  model,
  ModelSignal,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';

import { Merchant, MerchantDescriptionLink } from '@models/merchant.model';
import { MerchantApiService } from '../../services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { RestoreFocusOnHideDirective } from '@shared/directives/restore-focus-on-hide.directive';

/**
 * Manages a merchant's linked descriptions directly (PF-846) -- the explicit half of the
 * auto-capture + explicit management design. Lists the merchant's current links, each removable,
 * plus a text input to link a new raw description without needing a transaction to trigger it
 * (pre-seeding a match before an import, or fixing a bad auto-captured one). Deleting a link never
 * touches transactions already assigned this merchant -- only affects future matching.
 */
@Component({
  selector: 'app-merchant-description-links-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TooltipModule,
    RestoreFocusOnHideDirective,
  ],
  templateUrl: './merchant-description-links-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantDescriptionLinksDialogComponent {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** Two-way binding for the dialog visibility. */
  readonly visible: ModelSignal<boolean> = model.required<boolean>();

  /** The merchant whose linked descriptions are being managed. */
  readonly merchant: InputSignal<Merchant> = input.required<Merchant>();

  /** The merchant's current linked descriptions. */
  readonly links: WritableSignal<MerchantDescriptionLink[]> = signal([]);

  /** Loading state for the link-list fetch. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** The text currently typed into the "link a new description" input. */
  readonly newDescription: WritableSignal<string> = signal('');

  /** Indicates if an add-link request is in progress. */
  readonly adding: WritableSignal<boolean> = signal(false);

  constructor() {
    /** Loads the merchant's links fresh every time the dialog opens. */
    effect((): void => {
      if (this.visible()) {
        this.loadLinks();
      }
    });
  }

  private loadLinks(): void {
    this.loading.set(true);
    this.merchantApi
      .getDescriptionLinks(this.merchant().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (links): void => {
          this.links.set(links);
          this.loading.set(false);
        },
        error: (err: any): void => {
          console.error('Failed to load linked descriptions:', err);
          this.toast.error('Failed to load linked descriptions');
          this.loading.set(false);
        },
      });
  }

  /**
   * Closes the dialog and clears the pending "add" input.
   */
  onHide(): void {
    this.visible.set(false);
    this.newDescription.set('');
  }

  /**
   * Links the typed description to this merchant. Last-write-wins server-side: relinking a
   * description already linked elsewhere silently moves it here.
   */
  addLink(): void {
    const description: string = this.newDescription().trim();
    if (!description || this.adding()) {
      return;
    }

    this.adding.set(true);
    this.merchantApi
      .addDescriptionLink(this.merchant().id, description)
      .pipe(
        finalize((): void => this.adding.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (): void => {
          this.toast.success('Description linked');
          this.newDescription.set('');
          this.loadLinks();
        },
        error: (err: any): void => {
          console.error('Error linking description:', err);
          this.toast.error(err.error?.detail || 'Failed to link description');
        },
      });
  }

  /**
   * Removes a single link. Never touches transactions already assigned this merchant.
   * @param link the link to remove
   */
  deleteLink(link: MerchantDescriptionLink): void {
    this.merchantApi
      .deleteDescriptionLink(this.merchant().id, link.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (): void => {
          this.links.set(this.links().filter((l): boolean => l.id !== link.id));
          this.toast.success('Link removed');
        },
        error: (err: any): void => {
          console.error('Error removing link:', err);
          this.toast.error(err.error?.detail || 'Failed to remove link');
        },
      });
  }
}
