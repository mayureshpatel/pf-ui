import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthService } from '@core/auth/auth.service';

/**
 * Validator to ensure the password and confirm password fields match.
 *
 * @param group - The abstract control group containing the password fields.
 * @returns A validation error object if the passwords do not match, or null.
 */
function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

/**
 * Lower, upper, digit, one non-alphanumeric symbol, 8 to 100 characters, no whitespace. Mirrors the
 * backend's RegistrationRequest.
 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])\S{8,100}$/;

/** One line of the password checklist shown under the password field. */
export interface PasswordRule {
  readonly label: string;
  readonly met: boolean;
}

/**
 * The password rules, each checked on its own so the form can say which ones are still unmet.
 *
 * @param value - The password as typed.
 * @returns The rules in display order with whether each is met.
 */
export function passwordRules(value: string): PasswordRule[] {
  return [
    { label: '8 to 100 characters, no spaces', met: /^\S{8,100}$/.test(value) },
    { label: 'A lowercase letter', met: /[a-z]/.test(value) },
    { label: 'An uppercase letter', met: /[A-Z]/.test(value) },
    { label: 'A number', met: /\d/.test(value) },
    { label: 'A symbol, such as ! # - _', met: /[^A-Za-z\d\s]/.test(value) },
  ];
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
    MessageModule,
  ],
  templateUrl: './register.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly authService: AuthService = inject(AuthService);

  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);

  private readonly USERNAME_PATTERN: RegExp = /^\w{3,50}$/;

  constructor() {
    // Registration is a one-off, so start in the first field rather than leaving focus on the page.
    afterNextRender((): void => this.focusField('username'));
  }

  /**
   * The reactive form group for user registration.
   */
  readonly form = new FormGroup(
    {
      username: new FormControl<string>('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(50),
          Validators.pattern(this.USERNAME_PATTERN),
        ],
      }),
      email: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl<string>('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100),
          Validators.pattern(PASSWORD_PATTERN),
        ],
      }),
      confirmPassword: new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      /** Honeypot -- rendered off-screen; a real user never sees or fills this. */
      website: new FormControl<string>('', { nonNullable: true }),
    },
    { validators: passwordMatchValidator },
  );

  /** The password as typed, so the checklist updates on every keystroke. */
  private readonly passwordValue: Signal<string> = toSignal(
    this.form.controls.password.valueChanges,
    { initialValue: '' },
  );

  /** The password rules with their met state. */
  readonly rules: Signal<PasswordRule[]> = computed((): PasswordRule[] =>
    passwordRules(this.passwordValue()),
  );

  /** The rules still unmet, for the field's error message. */
  readonly unmetRules: Signal<PasswordRule[]> = computed((): PasswordRule[] =>
    this.rules().filter((rule: PasswordRule): boolean => !rule.met),
  );

  /** The unmet rules as a lowercase comma-separated phrase for the error message. */
  readonly unmetLabels: Signal<string> = computed((): string =>
    this.unmetRules()
      .map((rule: PasswordRule): string => rule.label.charAt(0).toLowerCase() + rule.label.slice(1))
      .join(', '),
  );

  /** Whether the password field is shown as plain text. */
  readonly showPassword: WritableSignal<boolean> = signal(false);

  /** Whether the confirm field is shown as plain text. */
  readonly showConfirm: WritableSignal<boolean> = signal(false);

  /**
   * Signal tracking the registration status to prevent duplicate submissions.
   */
  readonly isSubmitting: WritableSignal<boolean> = signal(false);

  /**
   * Signal holding the registration error message, if any.
   */
  readonly errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  /** Shows or hides the password text. */
  togglePassword(): void {
    this.showPassword.update((visible: boolean): boolean => !visible);
  }

  /** Shows or hides the confirm field's text. */
  toggleConfirm(): void {
    this.showConfirm.update((visible: boolean): boolean => !visible);
  }

  /** True when the field has been touched and fails validation. */
  fieldInvalid(name: 'username' | 'email' | 'password' | 'confirmPassword'): boolean {
    const control = this.form.controls[name];
    return control.touched && (control.invalid || (name === 'confirmPassword' && this.mismatch()));
  }

  /** True when both password fields are filled and differ. */
  mismatch(): boolean {
    return !!this.form.errors?.['passwordMismatch'] && this.form.controls.confirmPassword.touched;
  }

  private focusField(id: string): void {
    this.host.nativeElement.querySelector<HTMLInputElement>(`#${id}`)?.focus();
  }

  /**
   * Handles form submission for user registration.
   *
   * Validates all fields, triggers validation state feedback,
   * and sends the registration request to the AuthService.
   */
  onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      // Put the cursor on the first field that needs attention so the error is read in context.
      const first = (['username', 'email', 'password', 'confirmPassword'] as const).find(
        (name) => this.form.controls[name].invalid,
      );
      this.focusField(first ?? 'confirmPassword');
      return;
    }

    if (this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { username, email, password, website } = this.form.getRawValue();

    this.authService
      .register({ username, email, password, website })
      .pipe(finalize((): void => this.isSubmitting.set(false)))
      .subscribe({
        error: (err: Error): void => {
          this.errorMessage.set(err.message);
        },
      });
  }
}
