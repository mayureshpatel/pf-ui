import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { NotFoundComponent } from './not-found.component';

@Component({
  selector: 'app-dummy-dashboard',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DummyDashboardComponent {}

describe('NotFoundComponent', () => {
  let fixture: ComponentFixture<NotFoundComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFoundComponent],
      providers: [provideRouter([{ path: 'dashboard', component: DummyDashboardComponent }])],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundComponent);
    fixture.detectChanges();
  });

  it('moves focus to its heading so the change of page is announced', () => {
    const heading: HTMLElement = fixture.nativeElement.querySelector('h1');

    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(heading);
  });

  it('shows a clear not-found message', () => {
    expect(fixture.nativeElement.textContent).toContain('Page not found');
  });

  it('links back to the dashboard', () => {
    const routerLink = fixture.debugElement
      .query(By.directive(RouterLink))
      .injector.get(RouterLink);
    expect(routerLink.urlTree?.toString()).toBe('/dashboard');
  });

  it('offers real links to the dashboard and to transactions', () => {
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));

    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/dashboard', '/transactions']);
    for (const link of links) {
      expect(link.className).toContain('min-h-11');
    }
  });

  it('is calm and static: no glow, no pulse, a decorative icon', () => {
    const html: string = fixture.nativeElement.innerHTML;

    expect(html).not.toContain('animate-pulse');
    expect(html).not.toContain('blur');
    expect(fixture.nativeElement.querySelector('.pi-compass').getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
