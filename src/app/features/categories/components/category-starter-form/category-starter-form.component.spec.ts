import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryBatchRequest, CategoryType } from '@models/category.model';
import { STARTER_CATEGORIES } from '../../utils/starter-categories';
import { CategoryStarterFormComponent } from './category-starter-form.component';

describe('CategoryStarterFormComponent', () => {
  let fixture: ComponentFixture<CategoryStarterFormComponent>;
  let component: CategoryStarterFormComponent;
  let saved: CategoryBatchRequest[];

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const box = (testId: string): HTMLInputElement =>
    el().querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
  const click = (testId: string): void => {
    el().querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
    fixture.detectChanges();
  };
  const count = (): string =>
    el().querySelector('[data-testid="starter-count"]')!.textContent!.replace(/\s+/g, ' ').trim();
  const total: number = STARTER_CATEGORIES.reduce(
    (sum: number, p): number => sum + 1 + p.subcategories.length,
    0,
  );
  // indices into the starter tree
  const INCOME = 0;
  const HOUSING = 1;
  const TRANSFERS = 13;

  beforeEach(async () => {
    saved = [];
    await TestBed.configureTestingModule({
      imports: [CategoryStarterFormComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoryStarterFormComponent);
    component = fixture.componentInstance;
    component.save.subscribe((r) => saved.push(r));
    fixture.detectChanges();
  });

  it('should tick everything by default and count it', () => {
    const boxes = Array.from(el().querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

    expect(boxes.length).toBe(total);
    expect(boxes.every((b) => b.checked && !b.indeterminate)).toBe(true);
    expect(count()).toBe(`${total} categories selected`);
    expect(component.canSubmit()).toBe(true);
  });

  it('should group each parent in a fieldset with a legend and labelled checkboxes', () => {
    const group = el().querySelector('[data-testid="starter-group-1"]')!;

    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector('legend')!.textContent).toContain('Housing');
    expect(group.querySelector('label')!.contains(box('starter-parent-1'))).toBe(true);
  });

  it('should focus the first checkbox', async () => {
    await fixture.whenStable();

    expect(document.activeElement).toBe(box('starter-parent-0'));
  });

  it('should untick a parent together with all its subcategories', () => {
    const subs: number = STARTER_CATEGORIES[HOUSING].subcategories.length;

    click(`starter-parent-${HOUSING}`);

    expect(box(`starter-parent-${HOUSING}`).checked).toBe(false);
    for (let c = 0; c < subs; c++) expect(box(`starter-child-${HOUSING}-${c}`).checked).toBe(false);
    expect(count()).toBe(`${total - 1 - subs} categories selected`);
  });

  it('should show a parent as indeterminate while only some subcategories are ticked', () => {
    click(`starter-child-${HOUSING}-0`);

    expect(box(`starter-parent-${HOUSING}`).checked).toBe(true);
    expect(box(`starter-parent-${HOUSING}`).indeterminate).toBe(true);
    expect(el().querySelector(`[data-testid="starter-group-${HOUSING}"]`)!.textContent).toContain(
      `(${STARTER_CATEGORIES[HOUSING].subcategories.length - 1} of`,
    );
  });

  it('should tick every subcategory when an indeterminate parent is clicked', () => {
    click(`starter-child-${HOUSING}-0`);

    click(`starter-parent-${HOUSING}`);

    expect(box(`starter-parent-${HOUSING}`).indeterminate).toBe(false);
    expect(box(`starter-child-${HOUSING}-0`).checked).toBe(true);
    expect(count()).toBe(`${total} categories selected`);
  });

  it('should tick the parent when a subcategory is ticked again', () => {
    click('starter-select-none');

    click(`starter-child-${HOUSING}-2`);

    expect(box(`starter-parent-${HOUSING}`).checked).toBe(true);
    expect(box(`starter-child-${HOUSING}-2`).checked).toBe(true);
    expect(count()).toBe('2 categories selected');
  });

  it('should select none and all, and disable submit when nothing is ticked', () => {
    click('starter-select-none');

    expect(count()).toBe('0 categories selected');
    expect(component.canSubmit()).toBe(false);
    component.submit();
    expect(saved).toEqual([]);

    click('starter-select-all');

    expect(count()).toBe(`${total} categories selected`);
    expect(component.canSubmit()).toBe(true);
  });

  it('should build one group per ticked parent with only its ticked subcategories', () => {
    click('starter-select-none');
    click(`starter-child-${INCOME}-0`);
    click(`starter-child-${INCOME}-1`);
    click(`starter-parent-${TRANSFERS}`);
    click(`starter-child-${TRANSFERS}-1`); // untick one of the three again

    component.submit();

    expect(saved.length).toBe(1);
    const [income, transfers] = saved[0].groups;
    expect(saved[0].groups.length).toBe(2);
    expect(income).toEqual({
      name: 'Income',
      type: CategoryType.INCOME,
      color: STARTER_CATEGORIES[INCOME].color,
      icon: STARTER_CATEGORIES[INCOME].icon,
      subcategories: ['Salary', 'Interest'],
    });
    expect(transfers.type).toBe(CategoryType.TRANSFER);
    expect(transfers.subcategories).toEqual(['Credit card payment', 'Account transfer']);
  });

  it('should create a ticked parent with no ticked subcategories as a bare parent', () => {
    click('starter-select-none');
    click(`starter-child-${HOUSING}-0`);
    click(`starter-child-${HOUSING}-0`);

    component.submit();

    expect(saved[0].groups).toEqual([
      expect.objectContaining({ name: 'Housing', subcategories: [] }),
    ]);
  });

  it('should send the whole tree when nothing was changed', () => {
    component.submit();

    expect(saved[0].groups.length).toBe(STARTER_CATEGORIES.length);
    expect(saved[0].groups.map((g) => g.name)).toEqual(STARTER_CATEGORIES.map((p) => p.name));
  });

  it('should not submit while saving', () => {
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    component.submit();

    expect(saved).toEqual([]);
  });

  it('should report a change as dirty, and be pristine again once marked', () => {
    expect(component.dirty()).toBe(false);

    click(`starter-parent-${INCOME}`);

    expect(component.dirty()).toBe(true);
    component.markPristine();
    expect(component.dirty()).toBe(false);
  });

  it('should show a failed request beside the selection', () => {
    fixture.componentRef.setInput('errorMessage', 'Too many names.');
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="starter-error"]')!.textContent).toContain(
      'Too many names. Nothing was created.',
    );
  });
});
