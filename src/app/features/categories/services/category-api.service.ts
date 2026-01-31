import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { Category, CategoryFormData, CategoryGroup } from '@models/category.model';

@Injectable({
  providedIn: 'root'
})
export class CategoryApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categories`;

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl);
  }

  getGroupedCategories(): Observable<CategoryGroup[]> {
    return this.http.get<CategoryGroup[]>(`${this.apiUrl}/grouped`);
  }

  getChildCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/children`);
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
