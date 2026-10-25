import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';

/**
 * The drill path as a breadcrumb ("All spending > Food > Groceries"). Earlier crumbs are buttons that
 * step back to that point; the current crumb is plain text.
 */
@Component({
  selector: 'app-drill-breadcrumb',
  standalone: true,
  templateUrl: './drill-breadcrumb.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DrillBreadcrumbComponent {
  /** The crumbs from the start to the current position. */
  readonly crumbs: InputSignal<string[]> = input.required<string[]>();
  /** The index of the crumb to go back to (0 is the start). */
  readonly stepBack: OutputEmitterRef<number> = output<number>();
}
