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

  /**
   * Gets all categories for the current user, flat (not grouped by parent).
   * @returns the list of categories.
   */
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}`);
  }

  /**
   * Gets categories grouped under their parent category.
   * @returns the parent categories, each with its child categories attached.
   */
  getGroupedCategories(): Observable<CategoryGroup[]> {
    return this.http.get<Category[]>(`${this.apiUrl}`).pipe(
      map((response: Category[]): CategoryGroup[] => {
        const categories: Category[] = Array.isArray(response) ? response : [];
        const parents: Category[] = categories.filter((c: Category): boolean => !c.parent);

        return parents.map((parent: Category): CategoryGroup => ({
          parent,
          items: categories.filter((c: Category): boolean => c.parent?.id === parent.id)
        }));
      })
    );
  }

  /**
   * Gets only top-level (parent) categories.
   * @returns the list of parent categories.
   */
  getParentCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/parents`);
  }

  /**
   * Gets only subcategories (categories with a parent).
   * @returns the list of child categories.
   */
  getChildCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/children`);
  }

  /**
   * Gets categories that have at least one transaction assigned to them.
   * @returns the list of categories in use.
   */
  getCategoriesWithTransactions(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.transactionApiUrl}/existing-categories`);
  }

  /**
   * Gets merchants that have at least one transaction assigned to them.
   * @returns the list of merchants in use.
   */
  getMerchantsWithTransactions(): Observable<Merchant[]> {
    return this.http.get<Merchant[]>(`${this.transactionApiUrl}/existing-merchants`);
  }

  /**
   * Creates a new category.
   * @param data the category creation payload.
   * @returns the id of the newly created category.
   */
  createCategory(data: CategoryCreateRequest): Observable<number> {
    const userId: number | undefined = this.authService.user()?.id;
    return this.http.post<number>(this.apiUrl, { ...data, userId });
  }

  /**
   * Updates an existing category.
   * @param id the category id to update.
   * @param data the category update payload.
   * @returns the id of the updated category.
   */
  updateCategory(id: number, data: CategoryUpdateRequest): Observable<number> {
    const userId: number | undefined = this.authService.user()?.id;
    return this.http.put<number>(this.apiUrl, { ...data, id, userId });
  }

  /**
   * Deletes a category by id.
   * @param id the category id to delete.
   */
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
