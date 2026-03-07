import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env';
import {Category, CategoryCreateRequest, CategoryGroup, CategoryUpdateRequest} from '@models/category.model';
import {Merchant} from '@models/merchant.model';
import {AuthService} from '@core/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class CategoryApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/categories`;
  private readonly transactionApiUrl = `${environment.apiUrl}/transactions`;

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/grouped`);
  }

  getGroupedCategories(): Observable<CategoryGroup[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/grouped`).pipe(
      map((response: Category[]): CategoryGroup[] => {
        const categories: Category[] = Array.isArray(response) ? response : [];
        const parents: Category[] = categories.filter((c: Category): boolean => !c.parent);

        return parents.map((parent: Category): CategoryGroup => ({
          groupId: parent.id,
          groupLabel: parent.name,
          items: categories.filter((c: Category) => c.parent?.id === parent.id)
        }));
      })
    );
  }

  getChildCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/children`);
  }

  getCategoriesWithTransactions(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.transactionApiUrl}/existing-categories`);
  }

  getMerchantsWithTransactions(): Observable<Merchant[]> {
    return this.http.get<Merchant[]>(`${this.transactionApiUrl}/existing-merchants`);
  }

  createCategory(data: CategoryCreateRequest): Observable<number> {
    const userId: number | undefined = this.authService.user()?.id;
    return this.http.post<number>(this.apiUrl, { ...data, userId });
  }

  updateCategory(id: number, data: CategoryUpdateRequest): Observable<number> {
    const userId: number | undefined = this.authService.user()?.id;
    return this.http.put<number>(this.apiUrl, { ...data, id, userId });
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
