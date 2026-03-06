import {Component, inject, signal, WritableSignal} from '@angular/core';
import {ReactiveFormsModule, FormGroup, FormControl, Validators} from '@angular/forms';
import {finalize} from 'rxjs';
import {RouterLink} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {CheckboxModule} from 'primeng/checkbox';
import {InputTextModule} from 'primeng/inputtext';
import {PasswordModule} from 'primeng/password';
import {MessageModule} from 'primeng/message';
import {AuthService} from '@core/auth/auth.service';

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
    MessageModule
  ],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly authService: AuthService = inject(AuthService);

  form = new FormGroup({
    username: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    rememberMe: new FormControl<boolean>(false, { nonNullable: true })
  });

  isSubmitting: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  onSubmit(): void {
    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { username, password, rememberMe } = this.form.getRawValue();
    this.authService.login({ username, password }, rememberMe)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        error: (err: Error): void => {
          this.errorMessage.set(err.message);
        }
      });
  }
}
