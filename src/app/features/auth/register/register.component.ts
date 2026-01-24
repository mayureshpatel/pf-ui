import {Component, inject, signal, WritableSignal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {InputTextModule} from 'primeng/inputtext';
import {PasswordModule} from 'primeng/password';
import {MessageModule} from 'primeng/message';
import {AuthService} from '@core/auth/auth.service';
import {RegistrationRequest} from '@models/auth.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    MessageModule
  ],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private readonly authService: AuthService = inject(AuthService);

  username: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';

  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal<string | null>(null);
  usernameError: WritableSignal<string | null> = signal<string | null>(null);
  emailError: WritableSignal<string | null> = signal<string | null>(null);
  passwordError: WritableSignal<string | null> = signal<string | null>(null);
  confirmPasswordError: WritableSignal<string | null> = signal<string | null>(null);

  private readonly USERNAME_PATTERN: RegExp = /^[a-zA-Z0-9_]{3,50}$/;
  private readonly EMAIL_PATTERN: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly PASSWORD_PATTERN: RegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;

  onSubmit(): void {
    this.clearErrors();

    if (!this.validateForm()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const request: RegistrationRequest = {
      username: this.username,
      email: this.email,
      password: this.password
    };

    this.authService.register(request)
      .subscribe({
        error: (err: Error): void => {
          this.errorMessage.set(err.message);
          this.loading.set(false);
        }
      });
  }

  private validateForm(): boolean {
    let isValid: boolean = true;

    if (!this.username) {
      this.usernameError.set('Username is required');
      isValid = false;
    } else if (this.username.length < 3 || this.username.length > 50) {
      this.usernameError.set('Username must be between 3 and 50 characters');
      isValid = false;
    } else if (!this.USERNAME_PATTERN.test(this.username)) {
      this.usernameError.set('Username can only contain letters, numbers, and underscores');
      isValid = false;
    }

    if (!this.email) {
      this.emailError.set('Email is required');
      isValid = false;
    } else if (!this.EMAIL_PATTERN.test(this.email)) {
      this.emailError.set('Please enter a valid email address');
      isValid = false;
    }

    if (!this.password) {
      this.passwordError.set('Password is required');
      isValid = false;
    } else if (this.password.length < 8 || this.password.length > 100) {
      this.passwordError.set('Password must be between 8 and 100 characters');
      isValid = false;
    } else if (!this.PASSWORD_PATTERN.test(this.password)) {
      this.passwordError.set('Password must contain uppercase, lowercase, digit, and special character (@$!%*?&)');
      isValid = false;
    }

    if (!this.confirmPassword) {
      this.confirmPasswordError.set('Please confirm your password');
      isValid = false;
    } else if (this.password !== this.confirmPassword) {
      this.confirmPasswordError.set('Passwords do not match');
      isValid = false;
    }

    return isValid;
  }

  private clearErrors(): void {
    this.usernameError.set(null);
    this.emailError.set(null);
    this.passwordError.set(null);
    this.confirmPasswordError.set(null);
  }
}
