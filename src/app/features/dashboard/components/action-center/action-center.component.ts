import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { Router } from '@angular/router';
import { ActionItem, ActionType } from '@models/dashboard.model';

@Component({
  selector: 'app-action-center',
  standalone: true,
  imports: [CommonModule, CardModule, ButtonModule],
  templateUrl: './action-center.component.html'
})
export class ActionCenterComponent {
  items = input.required<ActionItem[]>();
  actionClick = output<ActionItem>();

  constructor(private router: Router) {}

  onAction(item: ActionItem): void {
    if (item.route) {
      if (item.route.includes('?')) {
        const [path, query] = item.route.split('?');
        const queryParams: Record<string, string> = {};
        query.split('&').forEach(q => {
          const [key, val] = q.split('=');
          queryParams[key] = val;
        });
        this.router.navigate([path], { queryParams });
      } else {
        this.router.navigate([item.route]);
      }
    }
    this.actionClick.emit(item);
  }

  getIcon(type: ActionType): string {
    switch (type) {
      case ActionType.TRANSFER_REVIEW: return 'pi pi-arrow-right-arrow-left';
      case ActionType.UNCATEGORIZED: return 'pi pi-tag';
      case ActionType.STALE_DATA: return 'pi pi-upload';
      default: return 'pi pi-bell';
    }
  }

  getSeverity(type: ActionType): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    switch (type) {
      case ActionType.TRANSFER_REVIEW: return 'info';
      case ActionType.UNCATEGORIZED: return 'warn';
      case ActionType.STALE_DATA: return 'danger';
      default: return 'secondary';
    }
  }
}
