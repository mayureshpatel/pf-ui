import { Component, input } from '@angular/core';
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
  selectedCount = input.required<number>();

  /**
   * Total number of items in the table.
   * Optional - used for displaying "X of Y selected".
   */
  totalCount = input<number>();

  /**
   * Color theme for the toolbar.
   * Default: 'primary'
   */
  severity = input<'primary' | 'info' | 'success'>('primary');
}
