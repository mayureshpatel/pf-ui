import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  MerchantRule,
  MerchantRuleChangePreview,
  MerchantRuleCreateRequest,
  MerchantRuleDraft,
  MerchantRuleMatchPreview,
  MerchantRuleUpdateRequest,
} from '@models/merchant-rule.model';
import { SKIP_GENERIC_ERROR_TOAST } from '@core/auth/error.interceptor';

const SKIP_TOAST_OPTIONS = { context: new HttpContext().set(SKIP_GENERIC_ERROR_TOAST, true) };

/**
 * Service for managing merchant rules: keywords that give imported or existing transactions one of
 * the user's merchants. The server takes the owner from the session, so no request carries a user id.
 */
@Injectable({
  providedIn: 'root',
})
export class MerchantRuleApiService {
  private readonly http: HttpClient = inject(HttpClient);
  private readonly apiUrl: string = `${environment.apiUrl}/merchant-rules`;

  /** Retrieves all merchant rules of the current user. */
  getRules(): Observable<MerchantRule[]> {
    return this.http.get<MerchantRule[]>(this.apiUrl, SKIP_TOAST_OPTIONS);
  }

  /**
   * Creates a new merchant rule.
   * @returns the new rule's id.
   */
  createRule(data: MerchantRuleCreateRequest): Observable<number> {
    return this.http.post<number>(this.apiUrl, data, SKIP_TOAST_OPTIONS);
  }

  /**
   * Updates an existing rule. The rule's id travels in the body (`PUT /merchant-rules`).
   * @returns the number of rows the server changed (not the rule's id).
   */
  updateRule(data: MerchantRuleUpdateRequest): Observable<number> {
    return this.http.put<number>(this.apiUrl, data, SKIP_TOAST_OPTIONS);
  }

  /** Deletes a specific merchant rule. */
  deleteRule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, SKIP_TOAST_OPTIONS);
  }

  /**
   * Previews which transactions a draft rule would match and what the engine would do with each.
   * Read-only; nothing is saved.
   */
  previewMatches(draft: MerchantRuleDraft): Observable<MerchantRuleMatchPreview> {
    const body: MerchantRuleDraft = {
      ruleId: draft.ruleId,
      keywords: draft.keywords,
      matchType: draft.matchType,
      priority: draft.priority,
      minAmount: draft.minAmount,
      maxAmount: draft.maxAmount,
      merchantId: draft.merchantId,
    };

    return this.http.post<MerchantRuleMatchPreview>(
      `${this.apiUrl}/match-preview`,
      body,
      SKIP_TOAST_OPTIONS,
    );
  }

  /** Lists the merchant-less transactions the saved rules would give a merchant. */
  previewApply(): Observable<MerchantRuleChangePreview[]> {
    return this.http.get<MerchantRuleChangePreview[]>(`${this.apiUrl}/preview`, SKIP_TOAST_OPTIONS);
  }

  /**
   * Runs the saved rules over the existing transactions that have no merchant.
   * @returns how many transactions changed.
   */
  applyRules(): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/apply`, {}, SKIP_TOAST_OPTIONS);
  }
}
