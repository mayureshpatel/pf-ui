import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthService } from '@core/auth/auth.service';
import { getSafeReturnUrl } from '@core/auth/utils/return-url.utils';

/**
 * Component for handling user authentication via the login form.
 *
 * Provides a secure interface for users to enter their credentials and
 * manage their session, including 'Remember Me' functionality.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    CardModule,
    CheckboxModule,
    InputTextModule,
    PasswordModule,
    MessageModule,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  /**
   * The reactive form group for login credentials.
   */
  readonly form = new FormGroup({
    username: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rememberMe: new FormControl<boolean>(false, {
      nonNullable: true,
    }),
  });

  /**
   * Signal tracking the submission status to prevent duplicate requests.
   */
  readonly isSubmitting: WritableSignal<boolean> = signal(false);

  /**
   * Signal holding the current authentication error message, if any.
   */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /**
   * Handles form submission.
   *
   * Validates the form, triggers visual feedback for invalid fields,
   * and initiates the authentication request via the AuthService.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { username, password, rememberMe } = this.form.getRawValue();

    this.authService
      .login({ username, password }, rememberMe)
      .pipe(finalize((): void => this.isSubmitting.set(false)))
      .subscribe({
        next: (): void => {
          // Only a same-app relative path is honoured; anything else falls back to the dashboard.
          const returnUrl: string | null = getSafeReturnUrl(
            this.route.snapshot.queryParamMap.get('returnUrl'),
          );
          this.router.navigateByUrl(returnUrl ?? '/dashboard');
        },
        error: (err: Error): void => {
          this.errorMessage.set(err.message);
        },
      });
  }
}
