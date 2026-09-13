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

  it('shows a clear not-found message', () => {
    expect(fixture.nativeElement.textContent).toContain('Page Not Found');
  });

  it('links back to the dashboard', () => {
    const routerLink = fixture.debugElement
      .query(By.directive(RouterLink))
      .injector.get(RouterLink);
    expect(routerLink.urlTree?.toString()).toBe('/dashboard');
  });
});
