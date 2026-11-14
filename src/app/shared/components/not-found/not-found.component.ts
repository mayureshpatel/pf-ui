import { ChangeDetectionStrategy, Component } from '@angular/core';
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
export class NotFoundComponent {}
