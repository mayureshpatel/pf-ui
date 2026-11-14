import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Shown for the wildcard route -- any URL that doesn't match a real route lands here instead of
 * being silently redirected to the dashboard, so a bad or outdated link is explained rather than
 * just bounced. It renders inside the app shell, so the navigation stays available.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  constructor() {
    // a bad link swaps the page without a reload, so say so: focus moves to the heading and a
    // screen reader reads it, instead of staying wherever it was on the page that was left
    afterNextRender((): void => this.heading().nativeElement.focus());
  }
}
