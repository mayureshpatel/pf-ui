import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '@core/auth/auth.service';
import { AuthResponse } from '@models/auth.model';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: Mocked<Pick<AuthService, 'login'>>;

  beforeEach(async () => {
    mockAuthService = {
      login: vi.fn().mockReturnValue(of({ token: 'mock-token' } as AuthResponse)),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    // assert & verify
    expect(component).toBeTruthy();
  });

  it('should mark the form touched and not call login when submitted empty', () => {
    // act
    component.onSubmit();

    // assert & verify
    expect(component.form.controls.username.touched).toBe(true);
    expect(component.form.controls.password.touched).toBe(true);
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('should call AuthService.login with the entered credentials and rememberMe flag', () => {
    // arrange
    component.form.setValue({ username: 'jdoe', password: 'hunter2', rememberMe: true });

    // act
    component.onSubmit();

    // assert & verify
    expect(mockAuthService.login).toHaveBeenCalledWith(
      { username: 'jdoe', password: 'hunter2' },
      true,
    );
  });

  it('should default rememberMe to false when not checked', () => {
    // arrange
    component.form.setValue({ username: 'jdoe', password: 'hunter2', rememberMe: false });

    // act
    component.onSubmit();

    // assert & verify
    expect(mockAuthService.login).toHaveBeenCalledWith(
      { username: 'jdoe', password: 'hunter2' },
      false,
    );
  });

  it('should set and clear isSubmitting around a successful login', () => {
    // arrange
    component.form.setValue({ username: 'jdoe', password: 'hunter2', rememberMe: false });

    // act
    component.onSubmit();

    // assert & verify -- login() resolves synchronously via of(...), so isSubmitting is already
    // reset by the time onSubmit() returns
    expect(component.isSubmitting()).toBe(false);
  });

  it('should not call login again while a submission is already in flight', () => {
    // arrange
    component.form.setValue({ username: 'jdoe', password: 'hunter2', rememberMe: false });
    component.isSubmitting.set(true);

    // act
    component.onSubmit();

    // assert & verify
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('should set errorMessage from a failed login and clear isSubmitting', () => {
    // arrange
    mockAuthService.login.mockReturnValue(throwError(() => new Error('Invalid credentials')));
    component.form.setValue({ username: 'jdoe', password: 'wrong', rememberMe: false });

    // act
    component.onSubmit();

    // assert & verify
    expect(component.errorMessage()).toBe('Invalid credentials');
    expect(component.isSubmitting()).toBe(false);
  });

  it('should clear a previous error message on a new submit attempt', () => {
    // arrange
    component.errorMessage.set('Stale error from a previous attempt');
    component.form.setValue({ username: 'jdoe', password: 'hunter2', rememberMe: false });

    // act
    component.onSubmit();

    // assert & verify
    expect(component.errorMessage()).toBeNull();
  });

  it('should submit real credentials entered through the DOM', () => {
    // arrange
    fixture.debugElement.query(By.css('#username')).nativeElement.value = 'jdoe';
    fixture.debugElement.query(By.css('#username')).nativeElement.dispatchEvent(new Event('input'));
    fixture.debugElement.query(By.css('#password')).nativeElement.value = 'hunter2';
    fixture.debugElement.query(By.css('#password')).nativeElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // act
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    // assert & verify
    expect(mockAuthService.login).toHaveBeenCalledWith(
      { username: 'jdoe', password: 'hunter2' },
      false,
    );
  });

  describe('single-owner sign-in surface', () => {
    it('should not offer a dead "Forgot password?" link or a public "Create account" link', () => {
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

      expect(text).not.toContain('Forgot password');
      expect(text).not.toContain('Create account');
      expect(fixture.nativeElement.querySelector('a')).toBeNull();
    });
  });

  describe('form accessibility', () => {
    const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

    it('should bind the password label to the real input', () => {
      const input = el().querySelector<HTMLInputElement>('#password')!;

      expect(input.tagName).toBe('INPUT');
      expect(input.labels?.[0]?.textContent).toContain('Password');
    });

    it('should focus the username field on load', () => {
      expect(document.activeElement).toBe(el().querySelector('#username'));
    });

    it('should reveal and hide the password through a labelled button', () => {
      const input = el().querySelector<HTMLInputElement>('#password')!;
      const toggle = el().querySelector<HTMLButtonElement>('button[aria-label="Show password"]')!;

      toggle.click();
      fixture.detectChanges();

      expect(input.type).toBe('text');
      expect(toggle.getAttribute('aria-label')).toBe('Hide password');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');

      toggle.click();
      fixture.detectChanges();

      expect(input.type).toBe('password');
    });

    it('should mark empty touched fields invalid and link them to their error message', () => {
      component.onSubmit();
      fixture.detectChanges();

      const username = el().querySelector('#username')!;
      const password = el().querySelector('#password')!;
      expect(username.getAttribute('aria-invalid')).toBe('true');
      expect(username.getAttribute('aria-describedby')).toBe('username-error');
      expect(el().querySelector('#username-error')?.textContent).toContain('Username is required');
      expect(password.getAttribute('aria-invalid')).toBe('true');
      expect(el().querySelector('#password-error')?.textContent).toContain('Password is required');
    });

    it('should move focus to the first invalid field after a failed submit', () => {
      component.form.patchValue({ username: 'jdoe' });
      el().querySelector<HTMLElement>('button[type="submit"]')?.focus();

      component.onSubmit();

      expect(document.activeElement).toBe(el().querySelector('#password'));
    });
  });
});

describe('LoginComponent post-login navigation', () => {
  function setup(returnUrl: string | null): { navigateByUrl: ReturnType<typeof vi.fn> } {
    const navigateByUrl = vi.fn();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
        {
          provide: AuthService,
          useValue: { login: vi.fn().mockReturnValue(of({ token: 't' } as AuthResponse)) },
        },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.form.setValue({
      username: 'jdoe',
      password: 'pw',
      rememberMe: false,
    });
    fixture.componentInstance.onSubmit();
    return { navigateByUrl };
  }

  it('should go to a safe returnUrl after login', () => {
    const { navigateByUrl } = setup('/transactions?page=2');

    expect(navigateByUrl).toHaveBeenCalledWith('/transactions?page=2');
  });

  it('should go to /dashboard when there is no returnUrl', () => {
    const { navigateByUrl } = setup(null);

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', '/login'])(
    'should fall back to /dashboard for the unsafe returnUrl %s',
    (url) => {
      const { navigateByUrl } = setup(url);

      expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    },
  );
});
