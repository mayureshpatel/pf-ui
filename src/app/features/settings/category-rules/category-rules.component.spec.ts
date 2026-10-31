import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { CategoryApiService } from '@features/categories/services/category-api.service';
import { ToastService } from '@core/services/toast.service';
import { Category, CategoryGroup } from '@models/category.model';
import { CategoryRule } from '@models/category-rule.model';
import { CategoryRulesComponent } from './category-rules.component';
import { CategoryRuleApiService } from './services/category-rule-api.service';
import { SettingsGuard } from '../settings.guard';

const gas = { id: 6, name: 'Gas', color: '' } as Category;
const streaming = { id: 7, name: 'Streaming', color: '' } as Category;
const groups: CategoryGroup[] = [
  { parent: { id: 1, name: 'Bills' } as Category, items: [gas, streaming] },
];
const rule = (
  id: number,
  priority: number,
  keywords: string[],
  category: Category | null,
  over: Partial<CategoryRule> = {},
): CategoryRule =>
  ({
    id,
    userId: 1,
    keywords,
    matchType: 'OR',
    priority,
    category,
    minAmount: null,
    maxAmount: null,
    ...over,
  }) as CategoryRule;
const netflix = rule(1, 1, ['netflix'], streaming);
const shell = rule(2, 5, ['shell', 'chevron'], gas, { minAmount: 10 });

describe('CategoryRulesComponent', () => {
  let fixture: ComponentFixture<CategoryRulesComponent>;
  let component: CategoryRulesComponent;
  let api: Mocked<
    Pick<
      CategoryRuleApiService,
      'getRules' | 'createRule' | 'updateRule' | 'deleteRule' | 'previewApply' | 'applyRules'
    >
  >;
  let toast: Mocked<Pick<ToastService, 'success' | 'error' | 'info'>>;
  let confirmation: { confirm: Mock<(c: Confirmation) => void> };
  let guard: SettingsGuard;

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(CategoryRulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  }
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  const rows = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-rule-row]'));
  const button = (label: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === label,
    );
  const makeDirty = (): void => {
    component['ruleForm']()!.form.controls.priority.setValue(9);
    component['ruleForm']()!.form.markAsDirty();
  };

  beforeEach(async () => {
    api = {
      getRules: vi.fn().mockReturnValue(of([netflix, shell])),
      createRule: vi.fn().mockReturnValue(of(77)),
      updateRule: vi.fn().mockReturnValue(of(2)),
      deleteRule: vi.fn().mockReturnValue(of(undefined)),
      previewApply: vi
        .fn()
        .mockReturnValue(of([{ description: 'NETFLIX', oldValue: 'None', newValue: 'Streaming' }])),
      applyRules: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    confirmation = { confirm: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [CategoryRulesComponent, NoopAnimationsModule],
      providers: [
        SettingsGuard,
        { provide: CategoryRuleApiService, useValue: api },
        {
          provide: CategoryApiService,
          useValue: { getGroupedCategories: vi.fn().mockReturnValue(of(groups)) },
        },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    }).compileComponents();
    guard = TestBed.inject(SettingsGuard);
  });

  it('should show rules by priority with their keywords, category and limits', async () => {
    // act
    await create();

    // assert & verify
    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('shell');
    expect(rows()[0].textContent).toContain('chevron');
    expect(rows()[0].textContent).toContain('Gas');
    expect(rows()[0].textContent).toContain('$10 or more');
    expect(rows()[0].textContent).toContain('Priority 5');
    expect(rows()[1].textContent).toContain('netflix');
    expect(text()).toContain('2 rules');
  });

  it('should render a rule with no category without throwing (PF-191)', async () => {
    // arrange
    api.getRules.mockReturnValue(of([rule(3, 0, ['starbucks'], null)]));

    // act
    await create();

    // assert & verify
    expect(rows()[0].textContent).toContain('Uncategorized');
  });

  it('should open a rule in the panel and return to overview on Back and Close', async () => {
    // arrange
    await create();

    // act
    rows()[0].click();
    await settle();
    const opened = {
      mode: component['panelMode'](),
      title: fixture.nativeElement.querySelector('aside h2').textContent.trim(),
    };
    button('Back to overview')!.click();
    await settle();
    const afterBack = component['panelMode']();
    rows()[1].click();
    await settle();
    component.onPanelClose();
    await settle();

    // assert & verify
    expect(opened).toEqual({ mode: 'rule', title: 'Edit rule' });
    expect(afterBack).toBe('overview');
    expect(component['panelMode']()).toBe('overview');
  });

  it('should filter by keyword and category name and say when nothing matches', async () => {
    // arrange
    await create();
    const search = (value: string): void => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('#rules-search');
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    // act
    search('chev');
    const byKeyword = rows().length;
    search('stream');
    const byCategory = rows().length;
    search('zzz');
    const none = text();
    button('Clear search')!.click();
    fixture.detectChanges();

    // assert & verify
    expect(byKeyword).toBe(1);
    expect(byCategory).toBe(1);
    expect(none).toContain('No rules match');
    expect(rows()).toHaveLength(2);
  });

  it('should save an edited rule with its id, keep it open and say so', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    makeDirty();

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(api.updateRule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, priority: 9, categoryId: 6 }),
    );
    expect(toast.success).toHaveBeenCalledWith('Rule saved');
    expect(component['panelMode']()).toBe('rule');
    expect(component['selectedRuleId']()).toBe(2);
    expect(api.getRules).toHaveBeenCalledTimes(2);
    expect(guard.dirty()).toBe(false);
  });

  it('should add a rule, open it and say so', async () => {
    // arrange
    await create();
    api.getRules.mockReturnValue(of([netflix, shell, rule(77, 0, ['costco'], gas)]));
    button('Add rule')!.click();
    await settle();
    component['ruleForm']()!.form.patchValue({ keywordsInput: 'costco', category: gas });

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(api.createRule).toHaveBeenCalledWith(
      expect.objectContaining({ keywords: ['costco'], categoryId: 6 }),
    );
    expect(toast.success).toHaveBeenCalledWith('Rule added');
    expect(component['panelMode']()).toBe('rule');
    expect(component['selectedRuleId']()).toBe(77);
  });

  it('should show the server message and stay when saving fails', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.updateRule.mockReturnValue(throwError(() => ({ error: { detail: 'Rule not found.' } })));
    makeDirty();

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(text()).toContain('Rule not found.');
    expect(component['saving']()).toBe(false);
    expect(component['panelMode']()).toBe('rule');
  });

  it('should ask before discarding a dirty form on every route', async () => {
    // arrange
    await create();
    const routes: [string, () => void][] = [
      ['another row', () => rows()[1].click()],
      ['add', () => component.startAdd()],
      ['back', () => component.back()],
      ['close', () => component.onPanelClose()],
    ];

    for (const [name, go] of routes) {
      // act
      rows()[0].click();
      await settle();
      makeDirty();
      confirmation.confirm.mockClear();
      go();

      // assert & verify
      expect(confirmation.confirm, name).toHaveBeenCalledTimes(1);
      expect(confirmation.confirm.mock.calls[0][0].header).toBe('Discard changes?');
      confirmation.confirm.mock.calls[0][0].accept!();
      await settle();
      component.back();
      confirmation.confirm.mock.calls.at(-1)?.[0].accept?.();
      await settle();
    }
  });

  it('should tell the settings host when the form is dirty', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();

    // act
    const clean = guard.dirty();
    makeDirty();

    // assert & verify
    expect(clean).toBe(false);
    expect(guard.dirty()).toBe(true);
  });

  it('should ask before deleting and remove the rule', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.getRules.mockReturnValue(of([netflix]));

    // act
    button('Delete rule')!.click();
    const asked = confirmation.confirm.mock.calls[0][0];
    asked.accept!();
    await settle();

    // assert & verify
    expect(asked.message).toContain('shell');
    expect(api.deleteRule).toHaveBeenCalledWith(2);
    expect(toast.success).toHaveBeenCalledWith('Rule deleted');
    expect(component['panelMode']()).toBe('overview');
    expect(rows()).toHaveLength(1);
  });

  it("should show the server's message and keep the rule when delete is refused", async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.deleteRule.mockReturnValue(throwError(() => ({ error: { detail: 'Rule is in use.' } })));

    // act
    button('Delete rule')!.click();
    confirmation.confirm.mock.calls[0][0].accept!();
    await settle();

    // assert & verify
    expect(toast.error).toHaveBeenCalledWith('Rule is in use.');
    expect(component['panelMode']()).toBe('rule');
    expect(rows()).toHaveLength(2);
  });

  it('should block a second save while one is in flight', async () => {
    // arrange
    await create();
    const pending = new Subject<number>();
    api.updateRule.mockReturnValue(pending);
    const request = { id: 2, keywords: ['shell'], categoryId: 6, priority: 5 };

    // act
    component.saveRule(request);
    component.saveRule(request);

    // assert & verify
    expect(api.updateRule).toHaveBeenCalledTimes(1);
    expect(component['saving']()).toBe(true);
  });

  it('should show a skeleton on the first load and dim on a reload', async () => {
    // arrange
    const first = new Subject<CategoryRule[]>();
    api.getRules.mockReturnValue(first);
    fixture = TestBed.createComponent(CategoryRulesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // act
    const skeleton = fixture.nativeElement.querySelector('p-skeleton');
    first.next([netflix, shell]);
    first.complete();
    await settle();
    const second = new Subject<CategoryRule[]>();
    api.getRules.mockReturnValue(second);
    component.loadRules();
    await settle();

    // assert & verify
    expect(skeleton).not.toBeNull();
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(rows()).toHaveLength(2);
  });

  it('should show the error state and clear stale rows when a reload fails', async () => {
    // arrange
    await create();
    api.getRules.mockReturnValue(throwError(() => new Error('boom')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    component.loadRules();
    await settle();

    // assert & verify
    expect(fixture.debugElement.query(By.css('app-page-error-state'))).not.toBeNull();
    expect(component['rules']()).toEqual([]);
  });

  it('should drop a slower response from an earlier load', async () => {
    // arrange
    await create();
    const slow = new Subject<CategoryRule[]>();
    const fast = new Subject<CategoryRule[]>();
    api.getRules.mockReturnValueOnce(slow).mockReturnValueOnce(fast);

    // act
    component.loadRules();
    component.loadRules();
    fast.next([netflix]);
    fast.complete();
    slow.next([netflix, shell]);
    slow.complete();
    await settle();

    // assert & verify
    expect(rows()).toHaveLength(1);
    expect(component['loading']()).toBe(false);
  });

  it('should open Add with no Back when there are no rules', async () => {
    // arrange
    api.getRules.mockReturnValue(of([]));

    // act
    await create();

    // assert & verify
    expect(component['panelMode']()).toBe('add');
    expect(text()).toContain('No rules yet');
    expect(button('Back')).toBeUndefined();
    expect(button('Close')).toBeUndefined();
  });

  it('should return to overview with a toast when the shown rule vanished', async () => {
    // arrange
    await create();
    rows()[0].click();
    await settle();
    api.getRules.mockReturnValue(of([netflix]));

    // act
    component.loadRules();
    await settle();

    // assert & verify
    expect(component['panelMode']()).toBe('overview');
    expect(toast.info).toHaveBeenCalledWith('That rule no longer exists.');
  });

  it('should preview and apply the rules', async () => {
    // arrange
    await create();

    // act
    button('Apply rules')!.click();
    await settle();
    const shown = component['showApplyDialog']();
    component.confirmApply();
    await settle();

    // assert & verify
    expect(shown).toBe(true);
    expect(api.applyRules).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Rules successfully applied to transactions.');
  });

  it('should say when no pending transactions match', async () => {
    // arrange
    api.previewApply.mockReturnValue(of([]));
    await create();

    // act
    component.openApplyPreview();

    // assert & verify
    expect(toast.info).toHaveBeenCalledWith('No pending transactions match your current rules.');
    expect(component['showApplyDialog']()).toBe(false);
  });

  it('should move focus into the panel and back to the opener', async () => {
    // arrange
    await create();
    document.body.appendChild(fixture.nativeElement);
    const opener = rows()[0];
    opener.focus();

    // act
    opener.click();
    await settle();
    await new Promise((resolve) => setTimeout(resolve));
    const inPanel = document.activeElement?.tagName;
    button('Back to overview')!.click();
    await settle();
    await new Promise((resolve) => setTimeout(resolve));

    // assert & verify
    expect(inPanel).toBe('ASIDE');
    expect(document.activeElement).toBe(rows()[0]);
    fixture.nativeElement.remove();
  });
});
