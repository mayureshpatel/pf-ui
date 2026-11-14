import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
  signal,
  WritableSignal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Persistent, on-page "something went wrong" state for a failed initial-load request --
 * distinct from an empty state (which means the load succeeded and there's genuinely no
 * data) and from a toast (which a user can miss or arrive after). Shows a Retry action that
 * re-triggers the caller's own load method.
 *
 * @example
 * <app-page-error-state message="Failed to load accounts." (retry)="loadAccounts()"/>
 */
@Component({
  selector: 'app-page-error-state',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './page-error-state.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageErrorStateComponent {
  /**
   * The message shown under the heading. Keep it safely vague per this app's error-messaging
   * convention -- a specific reason isn't necessary here, just that it failed and can be retried.
   */
  readonly message: InputSignal<string> = input('Something went wrong while loading this page.');

  /**
   * Emitted when the user clicks Retry. The caller re-runs its own load method.
   */
  readonly retry: OutputEmitterRef<void> = output<void>();

  /** True for a moment after Retry, so a repeat failure still reads as "it tried again". */
  protected readonly retrying: WritableSignal<boolean> = signal(false);

  private readonly destroyRef: DestroyRef = inject(DestroyRef);

  protected onRetry(): void {
    this.retrying.set(true);
    this.retry.emit();
    const timer = setTimeout((): void => this.retrying.set(false), 800);
    this.destroyRef.onDestroy((): void => clearTimeout(timer));
  }
}
