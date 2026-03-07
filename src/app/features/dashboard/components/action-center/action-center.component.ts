import {Component, inject, input, InputSignal, output, OutputEmitterRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {Router} from '@angular/router';
import {ActionItem, ActionType} from '@models/dashboard.model';

/**
 * Component for displaying actionable alerts and financial notifications.
 *
 * Provides users with direct shortcuts to resolve common data issues
 * such as uncategorized transactions or stale bank data.
 */
@Component({
  selector: 'app-action-center',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './action-center.component.html'
})
export class ActionCenterComponent {
  private readonly router: Router = inject(Router);

  /** The list of active items needing user attention. */
  readonly items: InputSignal<ActionItem[]> = input.required<ActionItem[]>();

  /** Emitted when an action item is clicked. */
  readonly actionClick: OutputEmitterRef<ActionItem> = output<ActionItem>();

  /**
   * Handles user interaction with an action item.
   *
   * Parses internal route strings into valid Angular navigation commands
   * and notifies parent components of the interaction.
   *
   * @param item - The clicked action item.
   */
  onAction(item: ActionItem): void {
    if (item.route) {
      if (item.route.includes('?')) {
        const [path, query] = item.route.split('?');
        const queryParams: Record<string, string> = {};

        query.split('&').forEach((q: string): void => {
          const [key, val] = q.split('=');
          queryParams[key] = val;
        });

        this.router.navigate([path], {queryParams});
      } else {
        this.router.navigate([item.route]);
      }
    }
    this.actionClick.emit(item);
  }

  /**
   * Maps an action type to its visual representation.
   * @param type - The system action type.
   * @returns A configuration object with icon and semantic styles.
   */
  getActionTheme(type: ActionType): { icon: string, styles: string } {
    switch (type) {
      case ActionType.TRANSFER_REVIEW:
        return {
          icon: 'pi pi-arrow-right-arrow-left',
          styles: 'bg-primary/10 text-primary ring-primary/20'
        };
      case ActionType.UNCATEGORIZED:
        return {
          icon: 'pi pi-tag',
          styles: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-amber-200/50'
        };
      case ActionType.STALE_DATA:
        return {
          icon: 'pi pi-clock',
          styles: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 ring-rose-200/50'
        };
      default:
        return {
          icon: 'pi pi-bell',
          styles: 'bg-surface-100 text-surface-600 ring-surface-200'
        };
    }
  }
}
