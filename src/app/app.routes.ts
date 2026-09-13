import {Routes} from '@angular/router';
import {requireAuth, guestGuard} from '@core/auth/auth.guard';
import {ShellComponent} from '@shared/components/layout/shell/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Sign In · Personal Finance'
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
    canActivate: [guestGuard],
    title: 'Create Account · Personal Finance'
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [requireAuth],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
        title: 'Dashboard · Personal Finance'
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./features/transactions/transactions.component').then((m) => m.TransactionsComponent),
        title: 'Transactions · Personal Finance'
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/accounts/accounts.component').then((m) => m.AccountsComponent),
        title: 'Accounts · Personal Finance'
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/categories.component').then(m => m.CategoriesComponent),
        title: 'Categories · Personal Finance'
      },
      {
        path: 'merchants',
        loadComponent: () => import('./features/merchants/merchants.component').then(m => m.MerchantsComponent),
        title: 'Merchants · Personal Finance'
      },
      {
        path: 'budgets',
        loadComponent: () => import('./features/budgets/budgets.component').then(m => m.BudgetsComponent),
        title: 'Budgets · Personal Finance'
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
        title: 'Settings · Personal Finance'
      },
      {
        path: 'recurring',
        loadComponent: () =>
          import('./features/recurring/recurring.component').then(m => m.RecurringComponent),
        title: 'Recurring · Personal Finance'
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then(m => m.ReportsComponent),
        title: 'Reports · Personal Finance'
      }
    ]
  },
  {
    path: '**',
    loadComponent: () =>
      import('@shared/components/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Page Not Found · Personal Finance'
  }
];
