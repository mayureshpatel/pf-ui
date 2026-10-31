import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeService } from '@core/services/theme.service';

/** The theme chooser: two cards (Light and Dark) in a radio group. The choice saves immediately. */
@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  templateUrl: './appearance-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceSettingsComponent {
  protected readonly theme: ThemeService = inject(ThemeService);
}
