import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { RuleApplicationUndoRequest, RuleApplicationUndoResult } from '@models/category-rule.model';

const SKIP_TOAST_OPTIONS = { context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true) };

/** Talks to the endpoint that undoes a rule the ledger just created and applied (PF-928). */
@Injectable({ providedIn: 'root' })
export class RuleApplicationApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.apiUrl}/rule-applications`;

  /**
   * Undoes a created-and-applied rule: restores each changed transaction's previous value (leaving
   * any that changed since alone) and deletes the rule.
   * @param request - The create-and-apply result, sent back as it was returned.
   * @returns how many transactions were restored, which were skipped, and whether the rule was deleted.
   */
  undo(request: RuleApplicationUndoRequest): Observable<RuleApplicationUndoResult> {
    return this.http.post<RuleApplicationUndoResult>(
      `${this.apiUrl}/undo`,
      request,
      SKIP_TOAST_OPTIONS,
    );
  }
}
