import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';

import { MerchantApiService } from '../../services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { PageErrorStateComponent } from '@shared/components/page-error-state/page-error-state.component';
import { Merchant, MerchantUpdateRequest } from '@models/merchant.model';

/**
 * One review cluster's local, editable view state (PF-842). {@code suggestedCleanName} starts as
 * the normalizer's own suggestion but is user-editable before confirming; {@code excludedIds}
 * lets the user drop specific rows out of the cluster without discarding the rest of it.
 */
interface ReviewClusterViewModel {
  suggestedCleanName: string;
  merchants: Merchant[];
  excludedIds: ReadonlySet<number>;
}

/**
 * "Needs Review" tab (PF-842): surfaces merchants whose clean name is blank or differs from a
 * fresh normalizer suggestion, clustered by that suggestion, so a user can bulk-confirm a whole
 * cluster in one action instead of correcting hundreds of rows by hand. This same flow is also
 * this project's resolution for PF-833 (historical remediation) -- a merchant mislabeled by the
 * old, buggy normalizer is flagged by the exact same condition as a brand-new, never-reviewed
 * one, so there's no separate backfill mechanism to build or run.
 */
@Component({
  selector: 'app-merchant-needs-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CardModule,
    InputTextModule,
    CheckboxModule,
    PageErrorStateComponent,
  ],
  templateUrl: './merchant-needs-review.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantNeedsReviewComponent implements OnInit {
  private readonly merchantApi: MerchantApiService = inject(MerchantApiService);
  private readonly toast: ToastService = inject(ToastService);
  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  /** Emitted once a cluster has been confirmed, so the parent Merchants page can refresh its
   *  grouped view -- the newly-labeled merchants should now appear correctly grouped there. */
  readonly confirmed: OutputEmitterRef<void> = output<void>();

  /** The user's current review clusters. */
  readonly clusters: WritableSignal<ReviewClusterViewModel[]> = signal([]);

  /** Global loading state for the initial fetch. */
  readonly loading: WritableSignal<boolean> = signal(false);

  /** Whether the most recent load attempt failed. */
  readonly loadError: WritableSignal<boolean> = signal(false);

  /** Ids of clusters (by index) currently mid-confirm, so their own "Confirm" button can show a
   *  spinner without blocking the other, unrelated cluster cards. */
  readonly confirmingIndex: WritableSignal<number | null> = signal(null);

  ngOnInit(): void {
    this.loadClusters();
  }

  /**
   * Fetches the user's current review clusters.
   */
  loadClusters(): void {
    this.loading.set(true);
    this.loadError.set(false);

    this.merchantApi
      .getMerchantsNeedingReview()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (clusters): void => {
          this.clusters.set(
            clusters.map((c): ReviewClusterViewModel => ({
              suggestedCleanName: c.suggestedCleanName,
              merchants: c.merchants,
              excludedIds: new Set<number>(),
            })),
          );
          this.loading.set(false);
        },
        error: (err: any): void => {
          console.error('Failed to load merchants needing review:', err);
          this.toast.error('Failed to load merchants needing review');
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  /**
   * Updates one cluster's editable suggested clean name.
   * @param index the cluster's index in {@link clusters}
   * @param value the newly-typed clean name
   */
  updateSuggestedName(index: number, value: string): void {
    this.clusters.update((clusters): ReviewClusterViewModel[] =>
      clusters.map((c, i): ReviewClusterViewModel =>
        i === index ? { ...c, suggestedCleanName: value } : c,
      ),
    );
  }

  /**
   * Toggles whether a specific member row is included when its cluster is confirmed.
   * @param index the cluster's index in {@link clusters}
   * @param merchantId the row to include or exclude
   */
  toggleExcluded(index: number, merchantId: number): void {
    this.clusters.update((clusters): ReviewClusterViewModel[] =>
      clusters.map((c, i): ReviewClusterViewModel => {
        if (i !== index) return c;
        const next = new Set(c.excludedIds);
        if (next.has(merchantId)) {
          next.delete(merchantId);
        } else {
          next.add(merchantId);
        }
        return { ...c, excludedIds: next };
      }),
    );
  }

  /**
   * Whether a specific member row is currently excluded from its cluster's confirm action.
   * @param cluster the cluster the row belongs to
   * @param merchantId the row to check
   */
  isExcluded(cluster: ReviewClusterViewModel, merchantId: number): boolean {
    return cluster.excludedIds.has(merchantId);
  }

  /**
   * The number of member rows that would actually be updated if this cluster were confirmed now.
   * @param cluster the cluster to count
   */
  includedCount(cluster: ReviewClusterViewModel): number {
    return cluster.merchants.filter((m): boolean => !cluster.excludedIds.has(m.id)).length;
  }

  /**
   * Confirms a cluster: bulk-relabels every non-excluded member to the (possibly user-edited)
   * suggested clean name, removes the cluster from view on success, and notifies the parent.
   * @param index the cluster's index in {@link clusters}
   */
  confirmCluster(index: number): void {
    const cluster = this.clusters()[index];
    if (!cluster || this.confirmingIndex() !== null) return;

    const cleanName = cluster.suggestedCleanName.trim();
    if (!cleanName) return;

    const requests: MerchantUpdateRequest[] = cluster.merchants
      .filter((m): boolean => !cluster.excludedIds.has(m.id))
      .map((m): MerchantUpdateRequest => ({ id: m.id, cleanName }));
    if (requests.length === 0) return;

    this.confirmingIndex.set(index);
    this.merchantApi
      .updateMerchantsBulk(requests)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize((): void => this.confirmingIndex.set(null)),
      )
      .subscribe({
        next: (): void => {
          this.toast.success(
            `"${cleanName}" confirmed for ${requests.length} merchant${requests.length === 1 ? '' : 's'}`,
          );
          this.clusters.update((clusters): ReviewClusterViewModel[] =>
            clusters.filter((_, i): boolean => i !== index),
          );
          this.confirmed.emit();
        },
        error: (err: any): void => {
          console.error('Failed to confirm merchant cluster:', err);
          this.toast.error(err.error?.detail || 'Failed to confirm cluster');
        },
      });
  }
}
