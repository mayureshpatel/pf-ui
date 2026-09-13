import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterLink} from '@angular/router';
import {ButtonModule} from 'primeng/button';

/**
 * Shown for the wildcard route -- any URL that doesn't match a real route lands here instead of
 * being silently redirected to the dashboard, so a bad or outdated link is explained rather than
 * just bounced.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotFoundComponent {
}
