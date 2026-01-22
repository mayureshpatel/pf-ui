import {Component} from '@angular/core';
import {CardModule} from 'primeng/card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CardModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
}
