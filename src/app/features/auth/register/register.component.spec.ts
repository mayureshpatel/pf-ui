import {ComponentFixture, TestBed} from '@angular/core/testing';
import {RegisterComponent} from './register.component';
import {AuthService} from '@core/auth/auth.service';
import {provideRouter} from '@angular/router';
import {of, throwError} from 'rxjs';
import {AuthResponse} from '@models/auth.model';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let authService: AuthService;
  let registerSpy: any;

  beforeEach(async () => {
    const authServiceMock = {
      register: (request: any) => of({token: 'mock-token'} as AuthResponse)
    };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        {provide: AuthService, useValue: authServiceMock}
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    registerSpy = authService.register;
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should validate required username field', () => {
    component.username = '';
    component.email = 'test@example.com';
    component.password = 'Password123!';
    component.confirmPassword = 'Password123!';

    component.onSubmit();

    expect(component.usernameError()).toBe('Username is required');
  });

  it('should validate username length', () => {
    component.username = 'ab';
    component.email = 'test@example.com';
    component.password = 'Password123!';
    component.confirmPassword = 'Password123!';

    component.onSubmit();

    expect(component.usernameError()).toBe('Username must be between 3 and 50 characters');
  });

  it('should validate username pattern', () => {
    component.username = 'invalid-username!';
    component.email = 'test@example.com';
    component.password = 'Password123!';
    component.confirmPassword = 'Password123!';

    component.onSubmit();

    expect(component.usernameError()).toBe('Username can only contain letters, numbers, and underscores');
  });

  it('should validate required email field', () => {
    component.username = 'testuser';
    component.email = '';
    component.password = 'Password123!';
    component.confirmPassword = 'Password123!';

    component.onSubmit();

    expect(component.emailError()).toBe('Email is required');
  });

  it('should validate email format', () => {
    component.username = 'testuser';
    component.email = 'invalid-email';
    component.password = 'Password123!';
    component.confirmPassword = 'Password123!';

    component.onSubmit();

    expect(component.emailError()).toBe('Please enter a valid email address');
  });

  it('should validate required password field', () => {
    component.username = 'testuser';
    component.email = 'test@example.com';
    component.password = '';
    component.confirmPassword = 'Password123!';

    component.onSubmit();

    expect(component.passwordError()).toBe('Password is required');
  });

  it('should validate password length', () => {
    component.username = 'testuser';
    component.email = 'test@example.com';
    component.password = 'Pass1!';
    component.confirmPassword = 'Pass1!';

    component.onSubmit();

    expect(component.passwordError()).toBe('Password must be between 8 and 100 characters');
  });

  it('should validate password complexity', () => {
    component.username = 'testuser';
    component.email = 'test@example.com';
    component.password = 'password';
    component.confirmPassword = 'password';

    component.onSubmit();

    expect(component.passwordError()).toBe('Password must contain uppercase, lowercase, digit, and special character (@$!%*?&)');
  });

  it('should validate password match', () => {
    component.username = 'testuser';
    component.email = 'test@example.com';
    component.password = 'Password123!';
    component.confirmPassword = 'DifferentPassword123!';

    component.onSubmit();

    expect(component.confirmPasswordError()).toBe('Passwords do not match');
  });
});
