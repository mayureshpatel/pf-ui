import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RuleRowComponent, RuleRowData } from './rule-row.component';

describe('RuleRowComponent', () => {
  let fixture: ComponentFixture<RuleRowComponent>;

  const rule = (over: Partial<RuleRowData> = {}): RuleRowData => ({
    keywords: ['netflix', 'hulu'],
    matchType: 'OR',
    minAmount: null,
    maxAmount: null,
    priority: 0,
    ...over,
  });

  function render(data: RuleRowData, selected = false): HTMLElement {
    fixture.componentRef.setInput('rule', data);
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RuleRowComponent] });
    fixture = TestBed.createComponent(RuleRowComponent);
    fixture.componentRef.setInput('targetLabel', 'Category');
  });

  it('should join the keywords with or, or and for an all-keywords rule', () => {
    expect(render(rule()).textContent).toContain('or');
    expect(render(rule({ matchType: 'AND' })).textContent).toContain('and');
  });

  it('should name the keywords and the target for a screen reader', () => {
    const text: string = render(rule()).textContent ?? '';
    expect(text).toContain('Keywords:');
    expect(text).toContain('Category:');
  });

  it('should hide the priority while it is the default', () => {
    expect(render(rule()).textContent).not.toContain('Priority');
  });

  it('should show a priority other than zero', () => {
    expect(render(rule({ priority: 5 })).textContent).toContain('Priority 5');
  });

  it('should show the amount limits', () => {
    expect(render(rule({ minAmount: 10 })).textContent).toContain('or more');
  });

  it('should mark the selected row as current', () => {
    const el: HTMLElement = render(rule(), true);
    expect(el.querySelector('button')!.getAttribute('aria-current')).toBe('true');
    expect(render(rule(), false).querySelector('button')!.hasAttribute('aria-current')).toBe(false);
  });
});
