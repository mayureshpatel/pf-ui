import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { SettingsSection } from '../../utils/settings-helpers';

/** The Settings sections: a vertical list from `lg` up, a row of pills on a phone. */
@Component({
  selector: 'app-settings-nav',
  standalone: true,
  templateUrl: './settings-nav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsNavComponent {
  readonly section: InputSignal<SettingsSection> = input.required<SettingsSection>();
  readonly sectionChange: OutputEmitterRef<SettingsSection> = output<SettingsSection>();

  protected readonly items: { key: SettingsSection; label: string; icon: string }[] = [
    { key: 'appearance', label: 'Appearance', icon: 'pi-palette' },
    { key: 'rules', label: 'Category rules', icon: 'pi-filter' },
    { key: 'tags', label: 'Tags', icon: 'pi-hashtag' },
  ];
}
