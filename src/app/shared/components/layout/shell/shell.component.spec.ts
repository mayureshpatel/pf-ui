import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChangeDetectionStrategy, Component, signal, Signal, WritableSignal } from '@angular/core';

import { ShellComponent } from './shell.component';
import { AuthService } from '@core/auth/auth.service';
import { ReviewCountService } from '@core/services/review-count.service';

@Component({
  selector: 'app-stub-page',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubPageComponent {}

describe('ShellComponent', () => {
  let component: ShellComponent;
  let fixture: ComponentFixture<ShellComponent>;
  let mockAuthService: { username: Signal<string>; logout: () => void };
  let logoutSpy: ReturnType<typeof vi.fn<() => void>>;
  let uncategorized: WritableSignal<number>;

  beforeEach(async () => {
    logoutSpy = vi.fn<() => void>();
    mockAuthService = { username: signal('testuser'), logout: logoutSpy };
    uncategorized = signal(0);

    await TestBed.configureTestingModule({
      imports: [ShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter([
          { path: 'dashboard', component: StubPageComponent },
          { path: 'merchants', component: StubPageComponent },
          { path: 'transactions', component: StubPageComponent },
          { path: 'transactions/:id', component: StubPageComponent },
        ]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ReviewCountService, useValue: { uncategorized, refresh: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give the Logout button an accessible name (PF-186)', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button:has(.pi-sign-out)',
    );
    expect(button.getAttribute('aria-label')).toBe('Logout');
  });
  describe('keyboard and screen reader entry points', () => {
    it('should give the menu button an accessible name', () => {
      // act
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-bars)');

      // assert & verify
      expect(button.getAttribute('aria-label')).toBe('Open navigation');
    });

    it('should not grab focus when the page loads', () => {
      // act
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-bars)');

      // assert & verify
      expect(button.hasAttribute('autofocus')).toBe(false);
    });

    it('should not add an H1 of its own, leaving the page heading as the only one', () => {
      // act
      const headings = fixture.nativeElement.querySelectorAll('h1');

      // assert & verify
      expect(headings).toHaveLength(0);
    });

    it('should offer a skip link before everything else that moves focus to the main content', () => {
      // arrange
      const host: HTMLElement = fixture.nativeElement;
      const link: HTMLAnchorElement = host.querySelector('a[data-testid="skip-link"]')!;
      const main: HTMLElement = host.querySelector('main')!;

      // act
      link.click();

      // assert & verify
      expect(link.textContent?.trim()).toBe('Skip to main content');
      expect(host.querySelector('header, nav, a, button')).toBe(link);
      expect(main.id).toBe('main-content');
      expect(document.activeElement).toBe(main);
    });

    it('should mark the current page in the navigation', async () => {
      // act
      await TestBed.inject(Router).navigateByUrl('/dashboard');
      fixture.detectChanges();

      // assert & verify
      const current = fixture.nativeElement.querySelectorAll('nav a[aria-current="page"]');
      expect(current.length).toBeGreaterThan(0);
      for (const link of Array.from<HTMLAnchorElement>(current)) {
        expect(link.getAttribute('href')).toBe('/dashboard');
      }
      expect(
        fixture.nativeElement.querySelectorAll('nav a:not([aria-current])').length,
      ).toBeGreaterThan(0);
    });
  });

  describe('avatar contrast', () => {
    it('should not set white text on the mid emerald fill, which is 2.5:1', () => {
      // act
      const avatar: HTMLElement = fixture.nativeElement.querySelector('p-avatar');

      // assert & verify -- primary-700 gives white 5.5:1; dark mode swaps to a dark label
      expect(avatar.classList).toContain('bg-primary-700');
      expect(avatar.classList).not.toContain('bg-primary');
      expect(avatar.classList).toContain('dark:bg-primary-400');
      expect(avatar.classList).toContain('dark:text-surface-900');
    });
  });

  describe('navigation drawer (PF-943)', () => {
    const openDrawer = async (): Promise<void> => {
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-bars)');
      button.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    afterEach(() => {
      component.sidebarVisible.set(false);
      fixture.detectChanges();
    });

    it('should move focus to the first link when it opens and make the page behind it inert', async () => {
      // act
      await openDrawer();

      // assert & verify
      const first: HTMLElement = document.querySelector('[data-testid="drawer-nav"] a')!;
      expect(document.activeElement).toBe(first);
      expect(fixture.nativeElement.querySelector('.grid').hasAttribute('inert')).toBe(true);
    });

    it('should name the drawer and label its close button', async () => {
      // act
      await openDrawer();

      // assert & verify
      expect(
        document.querySelector('p-drawer .p-drawer, .p-drawer')?.getAttribute('aria-label'),
      ).toBe('Navigation');
      expect(
        document.querySelector('.p-drawer-close-button button')?.getAttribute('aria-label'),
      ).toBe('Close navigation');
    });

    it('should return focus to the menu button and lift the inert state when it closes', async () => {
      // arrange
      await openDrawer();

      // act
      component.sidebarVisible.set(false);
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 800));

      // assert & verify
      expect(fixture.nativeElement.querySelector('.grid').hasAttribute('inert')).toBe(false);
      expect(document.activeElement).toBe(
        fixture.nativeElement.querySelector('button:has(.pi-bars)'),
      );
    });

    it('should size the drawer buttons to 44px and set Log out in rose-700', async () => {
      // act
      await openDrawer();

      // assert & verify
      const logout = document.querySelector('[data-testid="drawer-logout"] button')!;
      expect(logout.classList).toContain('min-h-11');
      expect(logout.classList).toContain('!text-rose-700');
      expect(document.querySelector('.p-drawer-close-button button')?.classList).toContain(
        'size-11',
      );
    });

    it('should offer Logout in its footer, for phones where the header hides it', async () => {
      // act
      await openDrawer();
      document.querySelector<HTMLButtonElement>('[data-testid="drawer-logout"] button')?.click();

      // assert & verify
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('frame (PF-943)', () => {
    it('should use one brand string and a quiet 1px header rule', () => {
      // act
      const header: HTMLElement = fixture.nativeElement.querySelector('header');

      // assert & verify
      expect(header.textContent).toContain('Personal Finance');
      expect(header.classList).toContain('border-b');
      expect(header.classList).not.toContain('border-b-2');
    });

    it('should list the links in three groups: Overview, Money and Setup (PF-947)', () => {
      // act
      const groups = Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll('nav [role="group"]'),
      ).map((g) => ({
        label: g.querySelector('[data-testid="nav-group-label"]')?.textContent?.trim(),
        links: Array.from(g.querySelectorAll('a')).map((a) => a.textContent?.trim()),
      }));

      // assert & verify
      expect(groups).toEqual([
        { label: 'Overview', links: ['Dashboard', 'Reports'] },
        { label: 'Money', links: ['Transactions', 'Accounts', 'Budgets', 'Recurring'] },
        { label: 'Setup', links: ['Categories', 'Merchants', 'Settings'] },
      ]);
    });

    it('should label each group for screen readers and keep the labels out of the tab order (PF-947)', () => {
      // act
      const groups = Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll('nav [role="group"]'),
      );

      // assert & verify
      expect(groups).toHaveLength(3);
      for (const group of groups) {
        const labelId = group.getAttribute('aria-labelledby')!;
        const label = group.querySelector<HTMLElement>(`#${labelId}`)!;
        expect(label.tagName).toBe('P');
        expect(label.getAttribute('tabindex')).toBeNull();
      }
    });

    it('should mark the current link with a bar and weight, not colour alone (PF-943)', async () => {
      // act
      await TestBed.inject(Router).navigateByUrl('/dashboard');
      fixture.detectChanges();

      // assert & verify
      const current: HTMLElement = fixture.nativeElement.querySelector(
        'nav a[aria-current="page"]',
      );
      expect(current.classList).toContain('font-medium');
      expect(current.classList).toContain('border-l-primary-700');
      expect(current.classList).toContain('border-l-4');
    });

    it('should give every nav link the one shared focus ring', () => {
      // act
      const links = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('nav a'));

      // assert & verify
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link.classList).toContain('focus-visible:outline-2');
        expect(link.classList).toContain('outline-primary-700');
      }
    });

    it('should not present the avatar as a control', () => {
      // act
      const avatar: HTMLElement = fixture.nativeElement.querySelector('p-avatar');

      // assert & verify
      expect(avatar.classList).not.toContain('cursor-pointer');
      expect(avatar.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('header page name (PF-947)', () => {
    const pageName = (): HTMLElement =>
      fixture.nativeElement.querySelector('[data-testid="header-page-name"]');

    it('should name the page after navigation, including a sub-route', async () => {
      // act
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/merchants');
      fixture.detectChanges();
      expect(pageName().textContent?.trim()).toBe('Merchants');

      await router.navigateByUrl('/transactions/42?tab=review');
      fixture.detectChanges();

      // assert & verify
      expect(pageName().textContent?.trim()).toBe('Transactions');
    });

    it('should hide the name from the accessibility tree, since the page heading names the page', () => {
      expect(pageName().getAttribute('aria-hidden')).toBe('true');
    });

    it('should show the name only below lg and the wordmark text only from lg up', () => {
      const wordmark = Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll('header span'),
      ).find((el) => el.textContent?.trim() === 'Personal Finance')!;

      expect(pageName().classList).toContain('lg:hidden');
      expect(wordmark.classList).toContain('hidden');
      expect(wordmark.classList).toContain('lg:inline');
    });

    it('should stay in view while the page scrolls below lg, on an opaque background', () => {
      const header: HTMLElement = fixture.nativeElement.querySelector('header');

      expect(header.classList).toContain('sticky');
      expect(header.classList).toContain('top-0');
      expect(header.classList).toContain('lg:static');
      expect(header.classList).toContain('bg-surface-0');
      expect(header.classList).toContain('dark:bg-surface-950');
    });

    it('should truncate a long name rather than push the buttons off screen', () => {
      expect(pageName().classList).toContain('truncate');
      expect(pageName().parentElement!.classList).toContain('min-w-0');
    });
  });

  describe('Transactions badge (PF-947)', () => {
    const badge = (): HTMLElement | null =>
      fixture.nativeElement.querySelector('[data-testid="transactions-badge"]');
    const transactionsLink = (): HTMLElement =>
      Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('nav a')).find((a) =>
        a.textContent?.includes('Transactions'),
      )!;

    it('should show the count, and tell screen readers what it means', () => {
      uncategorized.set(5);
      fixture.detectChanges();

      expect(badge()!.textContent?.trim()).toBe('5');
      expect(badge()!.getAttribute('aria-hidden')).toBe('true');
      expect(transactionsLink().querySelector('.sr-only')!.textContent).toContain(
        '5 need a category',
      );
    });

    it('should show nothing at zero', () => {
      uncategorized.set(0);
      fixture.detectChanges();

      expect(badge()).toBeNull();
      expect(transactionsLink().querySelector('.sr-only')).toBeNull();
    });

    it('should cap the figure at 99+', () => {
      uncategorized.set(100);
      fixture.detectChanges();
      expect(badge()!.textContent?.trim()).toBe('99+');

      uncategorized.set(99);
      fixture.detectChanges();
      expect(badge()!.textContent?.trim()).toBe('99');
    });

    it('should put the badge on the Transactions link only', () => {
      uncategorized.set(3);
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelectorAll('[data-testid="transactions-badge"]'),
      ).toHaveLength(1);
    });

    it('should ask for the count once when the shell opens', () => {
      const service = TestBed.inject(ReviewCountService) as unknown as {
        refresh: ReturnType<typeof vi.fn>;
      };

      expect(service.refresh).toHaveBeenCalledTimes(1);
    });
  });
});
