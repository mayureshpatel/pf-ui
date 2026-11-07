import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';
import { AuthService } from '@core/auth/auth.service';
import {
  CreateBothAndApplyRequest,
  CreateBothAndApplyResult,
  RuleApplicationUndoRequest,
  RuleApplicationUndoResult,
} from '@models/category-rule.model';

const SKIP_TOAST_OPTIONS = { context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true) };

/** Talks to the endpoints for rules the ledger creates and applies together or undoes (PF-928, PF-934). */
@Injectable({ providedIn: 'root' })
export class RuleApplicationApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly authService: AuthService = inject(AuthService);
  private readonly apiUrl: string = `${environment.apiUrl}/rule-applications`;

  /**
   * Creates a category rule and a merchant rule from the same keyword and applies both, all or
   * nothing, to the transactions chosen for each kind (PF-934).
   * @param request - Each kind's rule with its chosen transactions; the merchant may be a new name.
   * @returns each kind's result, which together are what an undo needs.
   */
  createBothAndApply(request: CreateBothAndApplyRequest): Observable<CreateBothAndApplyResult> {
    const userId: number | undefined = this.authService.user()?.id;
    return this.http.post<CreateBothAndApplyResult>(
      `${this.apiUrl}/create-both-and-apply`,
      { ...request, category: { ...request.category, rule: { ...request.category.rule, userId } } },
      SKIP_TOAST_OPTIONS,
    );
  }

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
