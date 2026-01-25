import { Component, input } from '@angular/core';
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
}
