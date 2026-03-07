import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TabsModule} from 'primeng/tabs';
import {CategoryRulesComponent} from './category-rules/category-rules.component';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';

/**
 * Root settings component acting as a container for various application configurations.
 *
 * Organizes settings into functional tabs, currently featuring Category Rules management.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    CategoryRulesComponent,
    ScreenToolbarComponent
  ],
  templateUrl: './settings.component.html'
})
export class SettingsComponent {
}
