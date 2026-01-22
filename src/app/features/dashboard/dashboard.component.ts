import { Component } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CardModule],
  template: `
    <div class="flex flex-col gap-6">
      <h1 class="text-3xl font-semibold text-color">Dashboard</h1>
      <p-card>
        <p class="text-muted-color">
          Welcome to your personal finance dashboard. This is a placeholder component.
        </p>
      </p-card>
    </div>
  `
})
export class DashboardComponent {}
