import {Component, inject, signal, WritableSignal} from '@angular/core';
import {AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {RouterLink} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {InputTextModule} from 'primeng/inputtext';
import {PasswordModule} from 'primeng/password';
import {MessageModule} from 'primeng/message';
import {AuthService} from '@core/auth/auth.service';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

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

  private readonly USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,50}$/;
  private readonly PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,100}$/;

  form = new FormGroup({
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
  }, { validators: passwordMatchValidator });

  isSubmitting: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { username, email, password } = this.form.getRawValue();
    this.authService.register({ username, email, password })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        error: (err: Error): void => {
          this.errorMessage.set(err.message);
        }
      });
  }
}
