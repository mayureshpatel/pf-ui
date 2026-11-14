import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  computed,
  inject,
  Signal,
  signal,
  viewChild,
  WritableSignal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { ReviewCountService } from '@core/services/review-count.service';
import { Tooltip } from 'primeng/tooltip';

/** A labelled run of navigation links. */
interface NavGroup {
  label: string;
  items: MenuItem[];
}

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

  /**
   * PF-947: the nine destinations grouped by what the owner does with them. The sidebar and the
   * drawer both render this.
   */
  readonly navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', icon: 'pi pi-home', routerLink: '/dashboard' },
        { label: 'Reports', icon: 'pi pi-chart-bar', routerLink: '/reports' },
      ],
    },
    {
      label: 'Money',
      items: [
        { label: 'Transactions', icon: 'pi pi-list', routerLink: '/transactions' },
        { label: 'Accounts', icon: 'pi pi-wallet', routerLink: '/accounts' },
        { label: 'Budgets', icon: 'pi pi-calendar', routerLink: '/budgets' },
        { label: 'Recurring', icon: 'pi pi-refresh', routerLink: '/recurring' },
      ],
    },
    {
      label: 'Setup',
      items: [
        { label: 'Categories', icon: 'pi pi-tags', routerLink: '/categories' },
        { label: 'Merchants', icon: 'pi pi-shop', routerLink: '/merchants' },
        { label: 'Settings', icon: 'pi pi-cog', routerLink: '/settings' },
      ],
    },
  ];

  private readonly router: Router = inject(Router);
  private readonly reviewCount: ReviewCountService = inject(ReviewCountService);

  /** The URL path being shown, updated on every navigation. */
  private readonly path: Signal<string> = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e: NavigationEnd): string => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** The name of the page being shown, for the header on phone and tablet. */
  readonly pageName: Signal<string> = computed((): string => {
    const path: string = this.path().split(/[?#]/)[0];
    const item: MenuItem | undefined = this.navGroups
      .flatMap((g: NavGroup): MenuItem[] => g.items)
      .find((i: MenuItem): boolean => path === i.routerLink || path.startsWith(`${i.routerLink}/`));
    return item?.label ?? '';
  });

  /** The Transactions badge: the uncategorized count, capped, or empty when there is none. */
  readonly transactionsBadge: Signal<string> = computed((): string => {
    const count: number = this.reviewCount.uncategorized();
    if (count <= 0) return '';
    return count > 99 ? '99+' : String(count);
  });

  /** Names the drawer for screen readers (PrimeNG gives it only a generic role). */
  protected readonly drawerPt = {
    root: { 'aria-label': 'Navigation' },
    pcCloseButton: { root: { class: 'size-11' } },
  };

  private readonly openNav = viewChild('openNav', { read: ElementRef });

  private wasOpen = false;

  constructor() {
    this.reviewCount.refresh();

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
