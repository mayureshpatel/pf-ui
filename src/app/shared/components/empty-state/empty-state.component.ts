import { ChangeDetectionStrategy, Component, input, InputSignal } from '@angular/core';

/**
 * The one empty state of the list screens: a title, a line saying what the screen is for or what
 * happened, and the next step as projected actions. It is a polite status region, so a screen that
 * empties after a search or filter says so to a screen reader. Actions are projected: the caller
 * decides which one is filled (at most one per screen) and which are outlined.
 *
 * @example
 * <app-empty-state title="No accounts yet" description="Add your first account to track balances.">
 *   <p-button label="Add account" [outlined]="true" (onClick)="startCreate()" />
 * </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html',
  styles: `
    @media (max-width: 1023px) {
      :host ::ng-deep .p-button {
        min-height: 2.75rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly title: InputSignal<string> = input.required<string>();
  readonly description: InputSignal<string> = input<string>('');
}
