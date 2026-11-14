import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Toolbar component for screen-level operations: a title slot, a filters slot and an actions slot.
 *
 * @example
 * <app-screen-toolbar>
 *   <h1 toolbarTitle class="heading-page">Accounts</h1>
 *   <div toolbarFilters>...</div>
 *   <div toolbarActions>...</div>
 * </app-screen-toolbar>
 */
@Component({
  selector: 'app-screen-toolbar',
  standalone: true,
  templateUrl: './screen-toolbar.html',
  styleUrl: './screen-toolbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScreenToolbarComponent {}
