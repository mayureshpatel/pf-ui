import {Component, inject, signal, WritableSignal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {ButtonModule} from 'primeng/button';
import {CardModule} from 'primeng/card';
import {CheckboxModule} from 'primeng/checkbox';
import {InputTextModule} from 'primeng/inputtext';
import {PasswordModule} from 'primeng/password';
import {MessageModule} from 'primeng/message';
import {AuthService} from '@core/auth/auth.service';
import {AuthRequest} from '@models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
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

  username: string = '';
  password: string = '';
  rememberMe: boolean = false;

  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal<string | null>(null);

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.errorMessage.set('Please enter username and password');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    let authRequest: AuthRequest = {username: this.username, password: this.password};
    this.authService.login(authRequest, this.rememberMe)
      .subscribe({
        error: (err: Error): void => {
          this.errorMessage.set(err.message);
          this.loading.set(false);
        }
      });
  }
}
