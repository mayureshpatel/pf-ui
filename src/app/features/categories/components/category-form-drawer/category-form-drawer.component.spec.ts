import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryFormDrawerComponent } from './category-form-drawer.component';
import {
  Category,
  CategoryCreateRequest,
  CategoryType,
  CategoryUpdateRequest,
} from '@models/category.model';
import { CATEGORY_COLORS, getCategoryColor } from '@shared/utils/category.utils';

describe('CategoryFormDrawerComponent', () => {
  let component: CategoryFormDrawerComponent;
  let fixture: ComponentFixture<CategoryFormDrawerComponent>;

  const cat = (
    id: number,
    name: string,
    parent: Category | null = null,
    color = '',
    icon = '',
  ): Category =>
    ({ id, userId: 1, name, type: CategoryType.EXPENSE, parent, color, icon }) as Category;

  const rent = cat(1, 'Rent');
  const subscriptions = cat(2, 'Subscriptions', rent);
  const dining = cat(3, 'Dining Out', null, '#3B82F6', 'pi-shopping-cart');
  const mockCategories: Category[] = [rent, subscriptions, dining];

  const setUp = (category: Category | null): void => {
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('categoryOptions', mockCategories);
    fixture.componentRef.setInput('category', category);
    fixture.detectChanges();
    component.onShow();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryFormDrawerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryFormDrawerComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    setUp(null);

    expect(component).toBeTruthy();
  });

  describe('isEditMode / drawerTitle / drawerIcon', () => {
    it('should reflect create mode when no category is provided', () => {
      setUp(null);

      expect(component.isEditMode()).toBe(false);
      expect(component.drawerTitle()).toBe('Create Category');
      expect(component.drawerIcon()).toBe('pi-plus');
    });

    it('should reflect edit mode when a category is provided', () => {
      setUp(dining);

      expect(component.isEditMode()).toBe(true);
      expect(component.drawerTitle()).toBe('Edit Category');
      expect(component.drawerIcon()).toBe('pi-tag');
    });
  });

  describe('parentOptions', () => {
    it('should only offer top-level categories as parents, excluding any with their own parent', () => {
      setUp(null);

      expect(component.parentOptions()).toEqual([
        { label: 'Rent', value: 1 },
        { label: 'Dining Out', value: 3 },
      ]);
    });

    it('should exclude the category currently being edited, to prevent self-parenting', () => {
      setUp(rent);

      expect(component.parentOptions().map((o) => o.value)).not.toContain(1);
      expect(component.parentOptions().map((o) => o.value)).toContain(3);
    });
  });

  describe('onShow', () => {
    it('should reset to blank defaults in create mode', () => {
      // arrange -- dirty the form first
      setUp(dining);

      // act
      fixture.componentRef.setInput('category', null);
      component.onShow();

      // assert & verify
      expect(component.form.controls.name.value).toBe('');
      expect(component.form.controls.color.value).toBe('');
      expect(component.form.controls.icon.value).toBe('');
      expect(component.form.controls.type.value).toBe(CategoryType.EXPENSE);
      expect(component.form.controls.parentId.value).toBeNull();
      expect(component.errorMessage()).toBeNull();
    });

    it('should patch every field from the category being edited, including its parent', () => {
      setUp(subscriptions);

      expect(component.form.controls.name.value).toBe('Subscriptions');
      expect(component.form.controls.parentId.value).toBe(1);
    });

    it('should derive a color from the name when editing a category with none set', () => {
      // arrange & act -- `rent` has color: '' in this suite's fixtures
      setUp(rent);

      // assert & verify
      expect(component.form.controls.color.value).toBe(getCategoryColor('Rent'));
    });

    it("should keep the category's own color when editing one that already has one", () => {
      setUp(dining);

      expect(component.form.controls.color.value).toBe('#3B82F6');
    });
  });

  describe('duplicate-name validation', () => {
    it('should block a new top-level category sharing a name with an existing top-level one', () => {
      setUp(null);
      component.form.controls.name.setValue('Rent');

      component.onSubmit();

      expect(component.errorMessage()).toBe(
        'A category with this name already exists as a top-level category.',
      );
    });

    it('should allow the same name under a different parent', () => {
      // arrange -- "Subscriptions" already exists under Rent; creating it under no parent (top
      // level) is a different scope and should be allowed
      const saveSpy = vi.fn();
      setUp(null);
      component.save.subscribe(saveSpy);
      component.form.controls.name.setValue('Subscriptions');

      // act
      component.onSubmit();

      // assert & verify
      expect(component.errorMessage()).toBeNull();
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should block the same name under the same parent', () => {
      setUp(null);
      component.form.controls.name.setValue('Subscriptions');
      component.form.controls.parentId.setValue(1); // under Rent, same as the existing one

      component.onSubmit();

      expect(component.errorMessage()).toBe(
        'A category with this name already exists under the same parent.',
      );
    });

    it('should not treat editing a category as a duplicate of itself when the name is unchanged', () => {
      const saveSpy = vi.fn();
      setUp(rent);
      component.save.subscribe(saveSpy);

      component.onSubmit();

      expect(component.errorMessage()).toBeNull();
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should be case-insensitive', () => {
      setUp(null);
      component.form.controls.name.setValue('RENT');

      component.onSubmit();

      expect(component.errorMessage()).toBe(
        'A category with this name already exists as a top-level category.',
      );
    });
  });

  describe('name validation', () => {
    it('should not submit and should touch controls when the name is blank', () => {
      const saveSpy = vi.fn();
      setUp(null);
      component.save.subscribe(saveSpy);

      component.onSubmit();

      expect(saveSpy).not.toHaveBeenCalled();
      expect(component.form.controls.name.touched).toBe(true);
    });

    it('should reject a whitespace-only name even though it passes Validators.required', () => {
      // arrange -- a non-empty string of only spaces satisfies Validators.required, so this is a
      // deliberate extra guard beyond the control-level validator, not redundant with it
      const saveSpy = vi.fn();
      setUp(null);
      component.save.subscribe(saveSpy);
      component.form.controls.name.setValue('   ');
      expect(component.form.controls.name.valid).toBe(true);

      // act
      component.onSubmit();

      // assert & verify
      expect(saveSpy).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBe('Category name is required.');
    });
  });

  describe('onSubmit create path', () => {
    it('should emit a CategoryCreateRequest with a derived color when none was picked', () => {
      const saveSpy = vi.fn();
      setUp(null);
      component.save.subscribe(saveSpy);
      component.form.controls.name.setValue('Utilities');

      component.onSubmit();

      const expected: CategoryCreateRequest = {
        name: 'Utilities',
        type: CategoryType.EXPENSE,
        color: getCategoryColor('Utilities'),
        icon: '',
        parentId: undefined,
      };
      expect(saveSpy).toHaveBeenCalledWith(expected);
    });

    it('should submit a subcategory with its chosen parentId', () => {
      const saveSpy = vi.fn();
      setUp(null);
      component.save.subscribe(saveSpy);
      component.form.controls.name.setValue('Streaming');
      component.form.controls.parentId.setValue(1);

      component.onSubmit();

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Streaming', parentId: 1 }),
      );
    });

    it('should trim the submitted name', () => {
      const saveSpy = vi.fn();
      setUp(null);
      component.save.subscribe(saveSpy);
      component.form.controls.name.setValue('  Utilities  ');

      component.onSubmit();

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Utilities' }));
    });

    it("characterization: an unset icon is submitted as '', not omitted/undefined", () => {
      // `icon: rawValue.icon ?? undefined` never actually substitutes undefined here, since the
      // icon FormControl is a non-nullable string -- its unset value is '', and '' ?? undefined
      // evaluates to '' (?? only replaces null/undefined). Same in both create and update, so
      // not an inconsistency between the two paths the way the color fallback bug was -- left as
      // a documented real behavior, not fixed.
      const saveSpy = vi.fn();
      setUp(null);
      component.save.subscribe(saveSpy);
      component.form.controls.name.setValue('Utilities');

      component.onSubmit();

      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ icon: '' }));
    });
  });

  describe('onSubmit update path', () => {
    it('should emit a CategoryUpdateRequest carrying the id, not a create request', () => {
      const saveSpy = vi.fn();
      setUp(dining);
      component.save.subscribe(saveSpy);
      component.form.controls.name.setValue('Dining & Takeout');

      component.onSubmit();

      const expected: CategoryUpdateRequest = {
        id: 3,
        name: 'Dining & Takeout',
        type: CategoryType.EXPENSE,
        color: '#3B82F6',
        icon: 'pi-shopping-cart',
        parentId: undefined,
      };
      expect(saveSpy).toHaveBeenCalledWith(expected);
    });

    it(
      "bug found and fixed here: clearing a category's color during an edit now correctly " +
        'falls back to a name-derived color, matching the create path, instead of submitting an ' +
        "empty color string (the update branch previously used '??', which never substitutes for " +
        'an empty string -- only for null/undefined -- so the fallback silently never ran)',
      () => {
        const saveSpy = vi.fn();
        setUp(dining); // dining starts with a real color, '#3B82F6'
        component.save.subscribe(saveSpy);
        component.selectColor('#3B82F6'); // re-clicking the already-selected swatch clears it

        component.onSubmit();

        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({ color: getCategoryColor('Dining Out') }),
        );
      },
    );
  });

  describe('selectColor / selectIcon', () => {
    it('should select a color', () => {
      setUp(null);

      component.selectColor('#10B981');

      expect(component.form.controls.color.value).toBe('#10B981');
    });

    it('should deselect a color when clicked again', () => {
      setUp(null);
      component.selectColor('#10B981');

      component.selectColor('#10B981');

      expect(component.form.controls.color.value).toBe('');
    });

    it('should select an icon', () => {
      setUp(null);

      component.selectIcon('pi-home');

      expect(component.form.controls.icon.value).toBe('pi-home');
    });

    it('should deselect an icon when clicked again', () => {
      setUp(null);
      component.selectIcon('pi-home');

      component.selectIcon('pi-home');

      expect(component.form.controls.icon.value).toBe('');
    });
  });

  describe('getIconLabel', () => {
    it('should title-case a multi-word icon code', () => {
      expect(component.getIconLabel('pi-shopping-cart')).toBe('Shopping Cart');
    });

    it('should return an empty string for an empty code', () => {
      expect(component.getIconLabel('')).toBe('');
    });
  });

  describe('rendering', () => {
    it('should highlight exactly the swatch matching the current color, not any other', () => {
      // dining's color, '#3B82F6', is CATEGORY_COLORS[0] -- matched by position rather than by
      // reading style.backgroundColor back, since the browser normalizes hex to rgb() on read
      setUp(dining);
      fixture.detectChanges();

      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('#color-picker button'),
      );
      const selectedIndex: number = CATEGORY_COLORS.indexOf('#3B82F6');
      expect(buttons[selectedIndex].className).toContain('ring-4');
      expect(buttons[(selectedIndex + 1) % buttons.length].className).not.toContain('ring-4');
    });

    it('should show placeholder preview text when the name is blank', () => {
      setUp(null);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('New Category Name');
    });

    it('should reflect the typed name in the live preview', () => {
      setUp(null);
      component.form.controls.name.setValue('Utilities');
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('Utilities');
    });
  });
});
