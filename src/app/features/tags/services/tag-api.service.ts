import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {environment} from '@env';
import {Tag, TagCreateRequest, TagUpdateRequest} from '@models/tag.model';
import {AuthService} from '@core/auth/auth.service';

/**
 * Service for managing user-defined tags: CRUD, and assigning/removing a tag on a transaction.
 */
@Injectable({
  providedIn: 'root'
})
export class TagApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl: string = `${environment.apiUrl}/tags`;

  /**
   * Retrieves all tags for the current user.
   */
  getTags(): Observable<Tag[]> {
    return this.http.get<Tag[]>(this.apiUrl);
  }

  /**
   * Creates a new tag.
   * @param data - The tag configuration (name, color).
   */
  createTag(data: TagCreateRequest): Observable<number> {
    const userId: number | undefined = this.authService.user()?.id;
    return this.http.post<number>(this.apiUrl, {...data, userId});
  }

  /**
   * Renames/recolors an existing tag.
   * @param data - The updated tag, including its id.
   */
  updateTag(data: TagUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, data);
  }

  /**
   * Deletes a tag.
   * @param id - The unique identifier of the tag.
   */
  deleteTag(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Assigns a tag to a transaction.
   * @param tagId - The tag to assign.
   * @param transactionId - The transaction to assign it to.
   */
  assignToTransaction(tagId: number, transactionId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${tagId}/transactions/${transactionId}`, {});
  }

  /**
   * Removes a tag from a transaction.
   * @param tagId - The tag to remove.
   * @param transactionId - The transaction to remove it from.
   */
  removeFromTransaction(tagId: number, transactionId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${tagId}/transactions/${transactionId}`);
  }
}
