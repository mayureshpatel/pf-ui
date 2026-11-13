import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
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
    ButtonModule,
    CardModule,
    CheckboxModule,
    InputTextModule,
    MessageModule,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService: AuthService = inject(AuthService);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  constructor() {
    // The owner signs in daily, so the first keystroke should land in the username field.
    afterNextRender((): void => this.focusField('username'));
  }

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
   * Whether the password field is currently shown as plain text.
   */
  readonly showPassword: WritableSignal<boolean> = signal(false);

  /** True when the username field has been touched and is empty. */
  usernameInvalid(): boolean {
    const control = this.form.controls.username;
    return control.invalid && control.touched;
  }

  /** True when the password field has been touched and is empty. */
  passwordInvalid(): boolean {
    const control = this.form.controls.password;
    return control.invalid && control.touched;
  }

  /** Shows or hides the password text. */
  togglePasswordVisibility(): void {
    this.showPassword.update((visible: boolean): boolean => !visible);
  }

  private focusField(id: 'username' | 'password'): void {
    this.host.nativeElement.querySelector<HTMLInputElement>(`#${id}`)?.focus();
  }

  /**
   * Handles form submission.
   *
   * Validates the form, triggers visual feedback for invalid fields,
   * and initiates the authentication request via the AuthService.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      // Put the cursor on the first field that needs attention so the error is read in context.
      this.focusField(this.form.controls.username.invalid ? 'username' : 'password');
      return;
    }

    if (this.isSubmitting()) {
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
