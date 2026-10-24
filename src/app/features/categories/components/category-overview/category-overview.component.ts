import {
  ChangeDetectionStrategy,
  Component,
  input,
  InputSignal,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { CategoryStats } from '../../utils/category-helpers';

/** The panel's default mode: how the categories are organised and used, and the two quick actions. */
@Component({
  selector: 'app-category-overview',
  standalone: true,
  templateUrl: './category-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryOverviewComponent {
  readonly stats: InputSignal<CategoryStats> = input.required<CategoryStats>();

  readonly add: OutputEmitterRef<void> = output<void>();
  readonly reviewUnused: OutputEmitterRef<void> = output<void>();

  plural(count: number, one: string, many: string): string {
    return count === 1 ? `${count} ${one}` : `${count.toLocaleString('en-US')} ${many}`;
  }
}
