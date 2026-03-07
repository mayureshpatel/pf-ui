import {Component, inject, signal, WritableSignal} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import {finalize} from 'rxjs';
import {RouterLink} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {InputTextModule} from 'primeng/inputtext';
import {PasswordModule} from 'primeng/password';
import {MessageModule} from 'primeng/message';
import {AuthService} from '@core/auth/auth.service';

/**
 * Validator to ensure the password and confirm password fields match.
 *
 * @param group - The abstract control group containing the password fields.
 * @returns A validation error object if the passwords do not match, or null.
 */
function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? {passwordMismatch: true} : null;
}

/**
 * Component for handling new user registration.
 *
 * Implements strict validation for usernames and passwords to ensure
 * account security and system integrity.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
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

  private readonly USERNAME_PATTERN: RegExp = /^\w{3,50}$/;
  private readonly PASSWORD_PATTERN: RegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;

  /**
   * The reactive form group for user registration.
   */
  readonly form = new FormGroup({
    username: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(this.USERNAME_PATTERN)
      ]
    }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email]
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(100),
        Validators.pattern(this.PASSWORD_PATTERN)
      ]
    }),
    confirmPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required]
    })
  }, {validators: passwordMatchValidator});

  /**
   * Signal tracking the registration status to prevent duplicate submissions.
   */
  readonly isSubmitting: WritableSignal<boolean> = signal(false);

  /**
   * Signal holding the registration error message, if any.
   */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Handles form submission for user registration.
   *
   * Validates all fields, triggers validation state feedback,
   * and sends the registration request to the AuthService.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const {username, email, password} = this.form.getRawValue();

    this.authService.register({username, email, password})
      .pipe(finalize((): void => this.isSubmitting.set(false)))
      .subscribe({
        error: (err: Error): void => {
          this.errorMessage.set(err.message);
        }
      });
  }
}
