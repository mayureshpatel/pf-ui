import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '@env';
import { Category, CategoryFormData, CategoryGroup } from '@models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categories`;
  private readonly apiUrlWithTransactions = `${environment.apiUrl}/transactions/existing-categories`;

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
    return this.http.get<Category[]>(`${this.apiUrlWithTransactions}`);
  }

  createCategory(data: CategoryFormData): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, data);
  }

  updateCategory(id: number, data: CategoryFormData): Observable<Category> {
    return this.http.put<Category>(`${this.apiUrl}/${id}`, data);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
