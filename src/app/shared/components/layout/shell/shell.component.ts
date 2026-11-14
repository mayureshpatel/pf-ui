import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { Tooltip } from 'primeng/tooltip';

/**
 * Shell component for the application layout.
 *
 * Provides a consistent layout structure with a sidebar, navigation menu, and user profile.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AvatarModule,
    ButtonModule,
    DrawerModule,
    Tooltip,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly authService: AuthService = inject(AuthService);

  sidebarVisible: WritableSignal<boolean> = signal(false);
  username: Signal<string> = this.authService.username;

  navItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/dashboard' },
    { label: 'Transactions', icon: 'pi pi-list', routerLink: '/transactions' },
    { label: 'Accounts', icon: 'pi pi-wallet', routerLink: '/accounts' },
    { label: 'Budgets', icon: 'pi pi-calendar', routerLink: '/budgets' },
    { label: 'Reports', icon: 'pi pi-chart-bar', routerLink: '/reports' },
    { label: 'Categories', icon: 'pi pi-tags', routerLink: '/categories' },
    { label: 'Merchants', icon: 'pi pi-shop', routerLink: '/merchants' },
    { label: 'Recurring', icon: 'pi pi-refresh', routerLink: '/recurring' },
    { label: 'Settings', icon: 'pi pi-cog', routerLink: '/settings' },
  ];

  /** Names the drawer for screen readers (PrimeNG gives it only a generic role). */
  protected readonly drawerPt = { root: { 'aria-label': 'Navigation' } };

  private readonly openNav = viewChild('openNav', { read: ElementRef });

  private wasOpen = false;

  constructor() {
    // Closing by any route (Escape, close button, link click) returns focus to the menu button,
    // without waiting for the drawer's leave animation to report back.
    effect((): void => {
      const open = this.sidebarVisible();
      if (this.wasOpen && !open) {
        this.restoreFocus();
      }
      this.wasOpen = open;
    });
  }

  /**
   * Toggles the sidebar visibility.
   */
  toggleSidebar(): void {
    this.sidebarVisible.update((v: boolean): boolean => !v);
  }

  /** Moves focus into the drawer once it is open, so the keyboard starts at its first link. */
  focusDrawer(): void {
    document.querySelector<HTMLElement>('[data-testid="drawer-nav"] a')?.focus();
  }

  /**
   * Returns focus to the menu button when the drawer closes. The grid is inert until the next
   * change detection, so the focus waits a tick.
   */
  restoreFocus(): void {
    setTimeout((): void => {
      this.openNav()?.nativeElement.querySelector('button')?.focus();
    }, 0);
  }

  /**
   * Moves focus to the main content, for the skip link. The link's own `#` target would be read as
   * a route change by the router, so the jump is made here.
   *
   * @param event - The click on the skip link.
   */
  skipToMain(event: Event): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }

  /**
   * Initiates the logout process.
   */
  logout(): void {
    this.authService.logout();
  }
}
