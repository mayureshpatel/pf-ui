import {Component, input, InputSignal} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-table-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './table-toolbar.html',
  styleUrl: './table-toolbar.css',
})
export class TableToolbarComponent {
  /**
   * Number of selected items.
   * Required - toolbar is hidden when this is 0.
   */
  selectedCount: InputSignal<number> = input.required<number>();

  /**
   * Total number of items in the table.
   * Optional - used for displaying "X of Y selected".
   */
  totalCount: InputSignal<number | undefined> = input<number>();

  /**
   * Color theme for the toolbar.
   * Default: 'primary'
   */
  severity: InputSignal<'primary' | 'info' | 'success'> = input<'primary' | 'info' | 'success'>('primary');
}
