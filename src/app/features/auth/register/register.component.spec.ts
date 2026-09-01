import {ComponentFixture, TestBed} from '@angular/core/testing';
import {RegisterComponent} from './register.component';
import {AuthService} from '@core/auth/auth.service';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {AuthResponse} from '@models/auth.model';
import { vi } from 'vitest';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: AuthService;

  beforeEach(async () => {
    const authServiceMock = {
      register: vi.fn().mockReturnValue(of({token: 'mock-token'} as AuthResponse))
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        {provide: AuthService, useValue: authServiceMock}
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  describe('honeypot field', () => {
    const fillRealFields = (): void => {
      component.form.setValue({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password1!',
        confirmPassword: 'Password1!',
        website: ''
      });
    };

    it('should submit successfully with an empty honeypot (a real user)', () => {
      fillRealFields();

      component.onSubmit();

      expect(authService.register).toHaveBeenCalledWith(
        expect.objectContaining({website: ''})
      );
    });

    it('should not require the honeypot field to be filled', () => {
      fillRealFields();

      expect(component.form.valid).toBe(true);
    });

    it('should include a filled honeypot value in the submitted request (backend rejects it)', () => {
      fillRealFields();
      component.form.controls.website.setValue('http://spam.example.com');

      component.onSubmit();

      // The frontend doesn't second-guess a filled honeypot itself -- it's not shown to real
      // users at all, so there's nothing to validate client-side. Rejection is the backend's
      // job (RegistrationService.register()); this just confirms the value round-trips.
      expect(authService.register).toHaveBeenCalledWith(
        expect.objectContaining({website: 'http://spam.example.com'})
      );
    });
  });
});
