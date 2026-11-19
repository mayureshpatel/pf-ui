import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PASSWORD_PATTERN, passwordRules, RegisterComponent } from './register.component';
import { AuthService } from '@core/auth/auth.service';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthResponse } from '@models/auth.model';
import { vi } from 'vitest';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: AuthService;

  beforeEach(async () => {
    const authServiceMock = {
      register: vi.fn().mockReturnValue(of({ token: 'mock-token' } as AuthResponse)),
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authServiceMock }],
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
        website: '',
      });
    };

    it('should submit successfully with an empty honeypot (a real user)', () => {
      fillRealFields();

      component.onSubmit();

      expect(authService.register).toHaveBeenCalledWith(expect.objectContaining({ website: '' }));
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
        expect.objectContaining({ website: 'http://spam.example.com' }),
      );
    });
  });

  it('PF-891: should colour the "Sign in" link with the accessible emerald pair', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLElement[];
    const link = links.find((a) => a.textContent?.includes('Sign in'));

    expect(link).toBeTruthy();
    expect(link!.classList).toContain('text-primary-700');
    expect(link!.classList).toContain('dark:text-primary-400');
    expect(link!.classList).not.toContain('text-primary');
  });

  describe('PF-951: password rules', () => {
    it.each(['Passw0rd#x', 'Passw0rd-x', 'Passw0rd_x', 'P@ssword1'])(
      'accepts %s (any symbol counts)',
      (value) => {
        expect(PASSWORD_PATTERN.test(value)).toBe(true);
        expect(passwordRules(value).every((rule) => rule.met)).toBe(true);
      },
    );

    it.each(['password1!', 'PASSWORD1!', 'Password!!', 'Password11', 'Pa1!', 'Pass word1!'])(
      'rejects %s and names an unmet rule',
      (value) => {
        expect(PASSWORD_PATTERN.test(value)).toBe(false);
        expect(passwordRules(value).some((rule) => !rule.met)).toBe(true);
      },
    );

    it('lists every rule as unmet for an empty password and updates as the user types', () => {
      expect(component.unmetRules().length).toBe(5);

      component.form.controls.password.setValue('Passw0rd#x');

      expect(component.unmetRules().length).toBe(0);
    });

    it('names the unmet rules in the error once the field is touched', () => {
      component.form.controls.password.setValue('password');
      component.form.controls.password.markAsTouched();
      fixture.detectChanges();

      const error: HTMLElement = fixture.nativeElement.querySelector('#password-error');
      expect(error.textContent).toContain('uppercase letter');
      expect(error.textContent).toContain('number');
      expect(error.textContent).toContain('symbol');
    });
  });

  describe('PF-951: accessibility wiring', () => {
    it('labels the real inputs and links an error to its field', () => {
      component.form.controls.username.markAsTouched();
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      for (const id of ['username', 'email', 'password', 'confirmPassword']) {
        const input = el.querySelector(`#${id}`);
        expect(input?.tagName).toBe('INPUT');
        expect(el.querySelector(`label[for="${id}"]`)).toBeTruthy();
      }
      const username = el.querySelector('#username')!;
      expect(username.getAttribute('aria-invalid')).toBe('true');
      expect(username.getAttribute('aria-describedby')).toBe('username-hint username-error');
      expect(el.querySelector('#username-error')).toBeTruthy();
    });

    it('does not autofocus the password inputs and offers keyboard-reachable reveal buttons', () => {
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('#password')?.hasAttribute('autofocus')).toBe(false);
      const toggles = el.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');
      expect(toggles.length).toBe(2);
      toggles[0].click();
      fixture.detectChanges();
      expect(el.querySelector('#password')?.getAttribute('type')).toBe('text');
      expect(toggles[0].getAttribute('aria-pressed')).toBe('true');
    });

    it('does not submit an invalid form', () => {
      component.onSubmit();

      expect(authService.register).not.toHaveBeenCalled();
    });

    it('says the account is the owner account on this server', () => {
      expect(fixture.nativeElement.textContent).toContain('owner account for this server');
    });
  });
});
