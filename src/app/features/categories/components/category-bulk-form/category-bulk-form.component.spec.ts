import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CategoryBulkFormComponent } from './category-bulk-form.component';
import { CategoryBatchRequest, CategoryBatchResult } from '@models/category.model';

describe('CategoryBulkFormComponent', () => {
  let fixture: ComponentFixture<CategoryBulkFormComponent>;
  let component: CategoryBulkFormComponent;
  let saved: CategoryBatchRequest[];
  let doneCount: number;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => el().querySelector(`[data-testid="${id}"]`);
  const type = (selector: string, value: string): void => {
    const field = el().querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const click = (selector: string): void => {
    el().querySelector<HTMLElement>(selector)!.click();
    fixture.detectChanges();
  };
  const problems = (): string[] =>
    Array.from(el().querySelectorAll('[data-testid="bulk-problem"]')).map((p) =>
      p.textContent!.trim(),
    );

  beforeEach(async () => {
    saved = [];
    doneCount = 0;
    await TestBed.configureTestingModule({
      imports: [CategoryBulkFormComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryBulkFormComponent);
    component = fixture.componentInstance;
    component.save.subscribe((r) => saved.push(r));
    component.done.subscribe(() => doneCount++);
    fixture.detectChanges();
  });

  it('should start with one card, labelled fields, and focus on the parent name', async () => {
    await fixture.whenStable();

    expect(el().querySelectorAll('[data-testid^="group-"]').length).toBe(1);
    expect(el().querySelector('label[for="bulk-name-0"]')?.textContent).toContain('Parent name');
    expect(el().querySelector('label[for="bulk-subs-0"]')?.textContent).toContain('Subcategories');
    expect(byTestId('remove-group')).toBeNull();
    expect(document.activeElement?.id).toBe('bulk-name-0');
  });

  it('should add cards with a Remove action, and never remove the first', () => {
    click('[data-testid="add-group"]');
    click('[data-testid="add-group"]');

    expect(el().querySelectorAll('[data-testid^="group-"]').length).toBe(3);
    expect(el().querySelectorAll('[data-testid="remove-group"]').length).toBe(2);

    component.removeGroup(0);
    click('[data-testid="remove-group"]');
    fixture.detectChanges();

    expect(el().querySelectorAll('[data-testid^="group-"]').length).toBe(2);
    expect(component.form.dirty).toBe(true);
  });

  it('should count the names that will be created, ignoring blank lines', () => {
    type('#bulk-name-0', 'Food');
    type('#bulk-subs-0', ' Coffee \n\n  \nGroceries\n');

    expect(byTestId('sub-count')?.textContent).toContain('2 subcategories will be created');
    expect(byTestId('bulk-summary')?.textContent).toContain('3 categories to create');
    expect(byTestId('bulk-summary')?.textContent).toContain('1 parent and 2 subcategories');
  });

  it('should require a parent name and keep Create disabled until there is one', () => {
    expect(component.canSubmit()).toBe(false);

    component.submit();
    fixture.detectChanges();
    expect(saved).toEqual([]);
    expect(byTestId('name-error')?.textContent).toContain('Parent name is required');

    type('#bulk-name-0', 'Food');
    expect(component.canSubmit()).toBe(true);
    expect(byTestId('name-error')).toBeNull();
  });

  it('should name an over-long value and block submitting', () => {
    const long = 'x'.repeat(51);
    type('#bulk-name-0', 'Food');
    type('#bulk-subs-0', `Ok\n${long}`);

    expect(problems()).toEqual([`"${'x'.repeat(30)}..." is longer than 50 characters.`]);
    expect(component.canSubmit()).toBe(false);

    type('#bulk-name-0', long);
    type('#bulk-subs-0', 'Ok');
    expect(problems().length).toBe(1);
  });

  it('should warn near the limits and block beyond them, with the numbers', () => {
    type('#bulk-name-0', 'Food');
    type('#bulk-subs-0', Array.from({ length: 240 }, (_, i) => `n${i}`).join('\n'));
    expect(byTestId('bulk-warning')?.textContent).toContain('limit of 300 names');
    expect(component.canSubmit()).toBe(true);

    type('#bulk-subs-0', Array.from({ length: 300 }, (_, i) => `n${i}`).join('\n'));
    expect(problems()).toEqual(['You can add at most 300 names at once; there are 301.']);
    expect(component.canSubmit()).toBe(false);

    for (let i = 0; i < 50; i++) component.addGroup();
    fixture.detectChanges();
    expect(problems().some((p) => p.includes('at most 50 parents') && p.includes('51'))).toBe(true);
  });

  it('should emit the groups with their shared type, color and icon, trimmed', () => {
    type('#bulk-name-0', '  Food ');
    type('#bulk-subs-0', 'Coffee\n\n Tea ');
    click('[data-testid="icon-0-1"]');
    click('[data-testid="color-0-2"]');
    click('[data-testid="add-group"]');
    type('#bulk-name-1', 'Pay');

    component.submit();

    expect(saved).toEqual([
      {
        groups: [
          {
            name: 'Food',
            type: 'EXPENSE',
            color: '#8B5CF6',
            icon: 'pi-home',
            subcategories: ['Coffee', 'Tea'],
          },
          { name: 'Pay', type: 'EXPENSE', color: '#3B82F6', icon: undefined, subcategories: [] },
        ],
      },
    ]);
  });

  it('should keep the input and show the error when the request failed', () => {
    type('#bulk-name-0', 'Food');
    fixture.componentRef.setInput('errorMessage', 'Name too long.');
    fixture.detectChanges();

    expect(byTestId('bulk-error')?.textContent).toContain('Name too long. Nothing was created.');
    expect((el().querySelector('#bulk-name-0') as HTMLInputElement).value).toBe('Food');
  });

  it('should show the created counts and each skipped name with its reason, then Done', () => {
    const result: CategoryBatchResult = {
      createdCount: 3,
      createdParents: 1,
      createdSubcategories: 2,
      skipped: [
        { name: 'Coffee', parentName: 'Food', reason: 'Already exists' },
        { name: 'Tea', parentName: 'Food', reason: 'Duplicate in request' },
      ],
    };
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();

    expect(byTestId('bulk-result')?.textContent).toContain('Created 3 categories');
    expect(byTestId('bulk-result')?.textContent).toContain('1 parent and 2 subcategories');
    const items = Array.from(el().querySelectorAll('[data-testid="skipped-list"] li')).map((li) =>
      li.textContent!.replace(/\s+/g, ' ').trim(),
    );
    expect(items.length).toBe(2);
    expect(items[0]).toContain('Coffee under Food');
    expect(items[0]).toContain('Already exists');
    expect(items[1]).toContain('Duplicate in request');
    expect(el().querySelector('form')).toBeNull();

    click('[data-testid="bulk-done"]');
    expect(doneCount).toBe(1);
  });
});
