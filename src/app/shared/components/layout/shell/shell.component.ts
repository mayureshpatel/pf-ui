import {Component, inject, Signal, signal, WritableSignal} from '@angular/core';
import {RouterLink, RouterLinkActive, RouterOutlet} from '@angular/router';
import {AvatarModule} from 'primeng/avatar';
import {ButtonModule} from 'primeng/button';
import {DrawerModule} from 'primeng/drawer';
import {MenuModule} from 'primeng/menu';
import {RippleModule} from 'primeng/ripple';
import {MenuItem} from 'primeng/api';
import {AuthService} from '@core/auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AvatarModule,
    ButtonModule,
    DrawerModule,
    MenuModule,
    RippleModule
  ],
  templateUrl: './shell.component.html'
})
export class ShellComponent {
  private readonly authService: AuthService = inject(AuthService);

  sidebarVisible: WritableSignal<boolean> = signal(false);
  username: Signal<string> = this.authService.username;

  navItems: MenuItem[] = [
    {label: 'Dashboard', icon: 'pi pi-home', routerLink: '/dashboard'},
    {label: 'Transactions', icon: 'pi pi-list', routerLink: '/transactions'},
    {label: 'Accounts', icon: 'pi pi-wallet', routerLink: '/accounts'},
    {label: 'Categories', icon: 'pi pi-tags', routerLink: '/categories'},
    {label: 'Vendor Rules', icon: 'pi pi-filter', routerLink: '/settings/vendor-rules'},
    {label: 'Reports', icon: 'pi pi-chart-bar', routerLink: '/reports'}
  ];

  userMenuItems: MenuItem[] = [
    {
      label: 'Logout',
      icon: 'pi pi-sign-out',
      command: () => this.logout()
    }
  ];

  toggleSidebar(): void {
    this.sidebarVisible.update((v: boolean): boolean => !v);
  }

  logout(): void {
    this.authService.logout();
  }
}
