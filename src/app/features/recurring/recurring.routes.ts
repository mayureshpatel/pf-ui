import {Routes} from '@angular/router';

export const RECURRING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./recurring.component').then(m => m.RecurringComponent)
  }
];
