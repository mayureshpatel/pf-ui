import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChangeDetectionStrategy, Component, signal, Signal } from '@angular/core';

import { ShellComponent } from './shell.component';
import { AuthService } from '@core/auth/auth.service';

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

  beforeEach(async () => {
    mockAuthService = { username: signal('testuser'), logout: () => undefined };

    await TestBed.configureTestingModule({
      imports: [ShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter([{ path: 'dashboard', component: StubPageComponent }]),
        { provide: AuthService, useValue: mockAuthService },
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

});
