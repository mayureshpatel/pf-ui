import {Component, input, InputSignal} from '@angular/core';
import { CommonModule } from '@angular/common';

// todo: check if we can remove this
/**
 * Toolbar component for screen-level operations.
 *
 * @example
 * <app-screen-toolbar
 *    [showDivider]= true
 * >
 * </app-screen-toolbar>
 </app-screen-toolbar>>
 */
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
  showDivider: InputSignal<boolean> = input(true);
}
