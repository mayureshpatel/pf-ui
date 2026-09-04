import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {signal} from '@angular/core';

import {ShellComponent} from './shell.component';
import {AuthService} from '@core/auth/auth.service';

describe('ShellComponent', () => {
  let component: ShellComponent;
  let fixture: ComponentFixture<ShellComponent>;
  let mockAuthService: any;

  beforeEach(async () => {
    mockAuthService = {username: signal('testuser'), logout: () => undefined};

    await TestBed.configureTestingModule({
      imports: [ShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {provide: AuthService, useValue: mockAuthService}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should give the Logout button an accessible name (PF-186)', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-sign-out)');
    expect(button.getAttribute('aria-label')).toBe('Logout');
  });
});
