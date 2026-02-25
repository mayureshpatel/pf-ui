import {Component, inject, input, InputSignal, output, OutputEmitterRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {CardModule} from 'primeng/card';
import {ButtonModule} from 'primeng/button';
import {Router} from '@angular/router';
import {ActionItem, ActionType} from '@models/dashboard.model';

@Component({
  selector: 'app-action-center',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './action-center.component.html'
})
export class ActionCenterComponent {
  private readonly router: Router = inject(Router);

  items: InputSignal<ActionItem[]> = input.required<ActionItem[]>();

  actionClick: OutputEmitterRef<ActionItem> = output<ActionItem>();

  /**
   * Click handler for the action item.
   * @param item the action item to perform the action on
   */
  onAction(item: ActionItem): void {
    if (item.route) {
      if (item.route.includes('?')) {
        const [path, query] = item.route.split('?');
        const queryParams: Record<string, string> = {};

        query.split('&').forEach(q => {
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
   * Get the icon for the action type based on the action type.
   * @param type the action type
   */
  getIcon(type: ActionType): string {
    switch (type) {
      case ActionType.TRANSFER_REVIEW: {
        return 'pi pi-arrow-right-arrow-left';
      }
      case ActionType.UNCATEGORIZED: {
        return 'pi pi-tag';
      }
      case ActionType.STALE_DATA: {
        return 'pi pi-upload';
      }
      default:
        return 'pi pi-bell';
    }
  }
}
