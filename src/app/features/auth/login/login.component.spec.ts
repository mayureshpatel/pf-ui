import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '@core/auth/auth.service';
import { AuthResponse } from '@models/auth.model';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: any;

  beforeEach(async () => {
    mockAuthService = {
      login: vi.fn().mockReturnValue(of({ token: 'mock-token' } as AuthResponse)),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: mockAuthService }],
    }).compileComponents();

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
    fixture.debugElement.query(By.css('#password input')).nativeElement.value = 'hunter2';
    fixture.debugElement
      .query(By.css('#password input'))
      .nativeElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // act
    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit');

    // assert & verify
    expect(mockAuthService.login).toHaveBeenCalledWith(
      { username: 'jdoe', password: 'hunter2' },
      false,
    );
  });
});
