import { Component, ContentChild, input, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-screen-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './screen-toolbar.html',
  styleUrl: './screen-toolbar.css',
})
export class ScreenToolbarComponent {
  /**
   * Whether to show a divider between filters and actions.
   * Default: true
   */
  showDivider = input(true);

  /**
   * Content projection for filters slot.
   * Used to detect if filters are provided.
   */
  @ContentChild('[toolbarFilters]', { read: TemplateRef }) filtersContent?: TemplateRef<any>;

  /**
   * Returns true if the filters slot has content.
   */
  get hasFilters(): boolean {
    return !!this.filtersContent;
  }
}
