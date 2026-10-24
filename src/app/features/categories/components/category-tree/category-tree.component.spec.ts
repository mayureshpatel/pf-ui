import { Mock, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Category, CategoryType } from '@models/category.model';
import { buildNodes, CategoryNode } from '../../utils/category-helpers';
import { CategoryTreeComponent } from './category-tree.component';

const cat = (id: number, name: string, parent: Category | null = null): Category =>
  ({
    id,
    userId: 1,
    name,
    type: CategoryType.EXPENSE,
    parent,
    icon: 'pi-tag',
    color: '#3B82F6',
  }) as Category;

const food = cat(1, 'Food');
const groceries = cat(2, 'Groceries', food);
const coffee = cat(3, 'Coffee', food);
const travel = cat(4, 'Travel');

describe('CategoryTreeComponent', () => {
  let fixture: ComponentFixture<CategoryTreeComponent>;
  let component: CategoryTreeComponent;
  const nodes = (): CategoryNode[] =>
    buildNodes([food, groceries, coffee, travel], [{ ...groceries, transactionCount: 301 }]);

  function render(
    over: Partial<{
      nodes: CategoryNode[];
      expanded: number[];
      selected: number | null;
      tickable: number[];
      ticked: number[];
      showChecks: boolean;
      loading: boolean;
    }> = {},
  ): void {
    fixture.componentRef.setInput('nodes', over.nodes ?? nodes());
    fixture.componentRef.setInput('expandedIds', new Set(over.expanded ?? []));
    fixture.componentRef.setInput('selectedCategoryId', over.selected ?? null);
    fixture.componentRef.setInput('tickable', new Set(over.tickable ?? []));
    fixture.componentRef.setInput('ticked', new Set(over.ticked ?? []));
    fixture.componentRef.setInput('showChecks', over.showChecks ?? false);
    fixture.componentRef.setInput('loading', over.loading ?? false);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find(
      (b) => text(b) === name || b.getAttribute('aria-label') === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CategoryTreeComponent] }).compileComponents();
    fixture = TestBed.createComponent(CategoryTreeComponent);
    component = fixture.componentInstance;
  });

  it('should show children under an expanded parent and hide them when collapsed', () => {
    // act
    render({ expanded: [1] });

    // assert & verify
    expect(all('[data-testid="open-category"]').map(text)).toEqual([
      expect.stringContaining('Food'),
      expect.stringContaining('Coffee'),
      expect.stringContaining('Groceries'),
      expect.stringContaining('Travel'),
    ]);

    // act
    render({ expanded: [] });

    // assert & verify
    expect(all('[data-testid="open-category"]').length).toBe(2);
  });

  it('should show the subcategory count and the group total, and Unused instead of zero', () => {
    // act
    render({ expanded: [1] });

    // assert & verify
    const rows = all('[data-testid="open-category"]').map(text);
    expect(rows[0]).toContain('2 subcategories');
    expect(rows[0]).toContain('301');
    expect(rows[1]).toContain('Unused');
    expect(rows[2]).toContain('301');
    expect(rows[3]).toContain('Unused');
  });

  it('should emit openCategory, toggleExpand and toggleTick from their controls', () => {
    // arrange
    render({ expanded: [1], showChecks: true, tickable: [3] });
    const opened: Mock<(c: Category) => void> = vi.fn();
    const expanded: Mock<(id: number) => void> = vi.fn();
    const ticked: Mock<(id: number) => void> = vi.fn();
    component.openCategory.subscribe(opened);
    component.toggleExpand.subscribe(expanded);
    component.toggleTick.subscribe(ticked);

    // act
    all<HTMLButtonElement>('[data-testid="open-category"]')[1].click();
    button('Collapse Food')?.click();
    all<HTMLInputElement>('input[type="checkbox"]')
      .find((c) => !c.disabled)
      ?.click();

    // assert & verify
    expect(opened).toHaveBeenCalledWith(expect.objectContaining({ name: 'Coffee' }));
    expect(expanded).toHaveBeenCalledWith(1);
    expect(ticked).toHaveBeenCalledWith(3);
  });

  it('should expose the expanded state on the toggle', () => {
    // act
    render({ expanded: [1] });

    // assert & verify
    expect(button('Collapse Food')?.getAttribute('aria-expanded')).toBe('true');
    render({ expanded: [] });
    expect(button('Expand Food')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('should show checkboxes only with showChecks and disable ones that are not tickable', () => {
    // act
    render({ expanded: [1], showChecks: false });

    // assert & verify
    expect(all('input[type="checkbox"]').length).toBe(0);

    // act
    render({ expanded: [1], showChecks: true, tickable: [3], ticked: [3] });

    // assert & verify
    const boxes = all<HTMLInputElement>('input[type="checkbox"]');
    expect(boxes.length).toBe(4);
    expect(boxes.filter((b) => !b.disabled).length).toBe(1);
    expect(boxes.find((b) => !b.disabled)?.checked).toBe(true);
    expect(boxes.find((b) => !b.disabled)?.getAttribute('aria-label')).toBe('Select Coffee');
  });

  it('should highlight the selected category with a dark-mode variant', () => {
    // act
    render({ expanded: [1], selected: 3 });

    // assert & verify
    const rows = all('[data-testid="tree-row"]');
    expect(rows[1].className).toContain('bg-primary-50');
    expect(rows[1].className).toContain('dark:bg-primary-900/30');
    expect(rows[0].className).not.toContain('bg-primary-50');
  });

  it('should dim the tree and mark it busy while loading', () => {
    // act
    render({ loading: true });

    // assert & verify
    const wrapper = fixture.nativeElement.querySelector('[data-testid="tree"]') as HTMLElement;
    expect(wrapper.getAttribute('aria-busy')).toBe('true');
    expect(wrapper.className).toContain('opacity-60');
  });

  it('should key rows by id so same-named categories both show', () => {
    // act
    render({ nodes: buildNodes([cat(10, 'Same'), cat(11, 'Same')], []) });

    // assert & verify
    expect(all('[data-testid="open-category"]').length).toBe(2);
  });

  it('should emit expandAll and collapseAll', () => {
    // arrange
    render();
    const expandAll = vi.fn();
    const collapseAll = vi.fn();
    component.expandAll.subscribe(expandAll);
    component.collapseAll.subscribe(collapseAll);

    // act
    button('Expand all')?.click();
    button('Collapse all')?.click();

    // assert & verify
    expect(expandAll).toHaveBeenCalledTimes(1);
    expect(collapseAll).toHaveBeenCalledTimes(1);
  });
});
