import {Routes} from '@angular/router';
import {authGuard, noAuthGuard} from '@core/auth/auth.guard';
import {ShellComponent} from '@shared/components/layout/shell/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [noAuthGuard]
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./features/transactions/transactions.component').then((m) => m.TransactionsComponent)
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/accounts/accounts.component').then((m) => m.AccountsComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/categories.component').then(m => m.CategoriesComponent)
      },
      {
        path: 'budgets',
        loadComponent: () => import('./features/budgets/budgets.component').then(m => m.BudgetsComponent)
      },
      {
        path: 'recurring',
        loadComponent: () => import('./features/recurring/recurring.component').then(m => m.RecurringComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
