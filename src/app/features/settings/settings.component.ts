import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { CategoryRulesComponent } from './category-rules/category-rules.component';
import { TagsComponent } from './tags/tags.component';
import { ScreenToolbarComponent } from '@shared/components/screen-toolbar/screen-toolbar';
import { ThemeService } from '@core/services/theme.service';

/**
 * Root settings component acting as a container for various application configurations.
 *
 * Organizes settings into functional tabs: Category Rules, Tags, and Appearance.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabsModule,
    ToggleSwitch,
    CategoryRulesComponent,
    TagsComponent,
    ScreenToolbarComponent,
  ],
  templateUrl: './settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  readonly theme: ThemeService = inject(ThemeService);
}
