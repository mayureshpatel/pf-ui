import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SettingsSection } from '../../utils/settings-helpers';

/** One entry in the Settings list. */
interface NavItem {
  key: SettingsSection | 'merchant-rules';
  label: string;
  icon: string;
  /** Where an entry that moved off this page now lives. */
  moved?: { path: string; params: Record<string, string>; where: string };
}

/**
 * The Settings sections: a vertical list from `lg` up, a row of pills on a phone. Merchant rules
 * moved to the Merchants page; its entry stays here as a link so people who look for it find it.
 */
@Component({
  selector: 'app-settings-nav',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './settings-nav.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsNavComponent {
  readonly section: InputSignal<SettingsSection> = input.required<SettingsSection>();
  readonly sectionChange: OutputEmitterRef<SettingsSection> = output<SettingsSection>();

  /** A section, or (`moved`) an entry that now lives elsewhere and is a link there. */
  protected readonly items: NavItem[] = [
    { key: 'appearance', label: 'Appearance', icon: 'pi-palette' },
    { key: 'rules', label: 'Category rules', icon: 'pi-filter' },
    {
      key: 'merchant-rules',
      label: 'Merchant rules',
      icon: 'pi-shop',
      moved: { path: '/merchants', params: { view: 'rules' }, where: 'on Merchants' },
    },
    { key: 'tags', label: 'Tags', icon: 'pi-hashtag' },
  ];
  protected readonly itemClass: string =
    'flex w-full cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-left text-sm whitespace-nowrap min-h-11 lg:rounded-xl';
  protected readonly idleClass: string =
    'border-surface-200 bg-surface-0 hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-900 dark:hover:bg-surface-800';
  protected readonly activeClass: string =
    'border-primary-700 bg-primary-50 font-semibold text-primary-700 dark:border-primary-400 dark:bg-primary-950 dark:text-primary-400';

  /** The section an item opens; only called for items that are sections. */
  protected sectionOf(item: NavItem): SettingsSection {
    return item.key as SettingsSection;
  }
}
