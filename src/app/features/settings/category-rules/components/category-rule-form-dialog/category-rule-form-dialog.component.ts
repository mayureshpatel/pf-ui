import {
  Component,
  inject,
  input,
  InputSignal,
  OnChanges,
  output,
  OutputEmitterRef,
  signal,
  SimpleChanges,
  WritableSignal
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {InputNumberModule} from 'primeng/inputnumber';
import {SelectModule} from 'primeng/select';
import {MessageModule} from 'primeng/message';
import {CategoryRuleApiService} from '../../services/category-rule-api.service';
import {CategoryApiService} from '@features/categories/services/category-api.service';
import {ToastService} from '@core/services/toast.service';
import {CategoryGroup} from '@models/category.model';
import {CategoryRuleRequest} from '@models/category-rule.model';

@Component({
  selector: 'app-category-rule-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    MessageModule
  ],
  templateUrl: './category-rule-form-dialog.component.html'
})
export class CategoryRuleFormDialogComponent implements OnChanges {
  // injected services
  private readonly api: CategoryRuleApiService = inject(CategoryRuleApiService);
  private readonly categoryApi: CategoryApiService = inject(CategoryApiService);
  private readonly toast: ToastService = inject(ToastService);

  // input signals
  visible: InputSignal<boolean> = input.required<boolean>();

  // output signals
  visibleChange: OutputEmitterRef<boolean> = output<boolean>();
  save: OutputEmitterRef<void> = output<void>();

  // signals
  categoryGroups: WritableSignal<CategoryGroup[]> = signal([]);
  loading: WritableSignal<boolean> = signal(false);
  errorMessage: WritableSignal<string | null> = signal(null);

  formData: CategoryRuleRequest = {
    keyword: '',
    category: undefined,
    priority: 0
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible()) {
      this.resetForm();
      this.loadCategories();
    }
  }

  loadCategories(): void {
    this.categoryApi.getGroupedCategories().subscribe({
      next: (groups: CategoryGroup[]): void => this.categoryGroups.set(groups),
      error: (error: any): void => {
        console.error('Error loading categories:', error);
        this.toast.error('Failed to load categories')
      }
    });
  }

  onHide(): void {
    this.visibleChange.emit(false);
    this.resetForm();
  }

  onSubmit(): void {
    if (!this.formData.keyword || !this.formData.category) {
      this.errorMessage.set('Keyword and Category are required');
      return;
    }

    this.loading.set(true);
    this.api.createRule(this.formData).subscribe({
      next: (): void => {
        this.toast.success('Rule created successfully');
        this.save.emit();
        this.onHide();
      },
      error: (error: any): void => {
        console.error('Error creating rule:', error);

        this.errorMessage.set(error.error?.detail || 'Failed to create rule');
        this.loading.set(false);
      }
    });
  }

  resetForm(): void {
    this.formData = {keyword: '', category: undefined, priority: 0};
    this.errorMessage.set(null);
    this.loading.set(false);
  }
}
