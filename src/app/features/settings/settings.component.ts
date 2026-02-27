import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TabsModule} from 'primeng/tabs';
import {CategoryRulesComponent} from './category-rules/category-rules.component';
import {ScreenToolbarComponent} from '@shared/components/screen-toolbar/screen-toolbar';

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
