import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuleKind } from '../../utils/rule-kind';
import { RuleKindChooserComponent } from './rule-kind-chooser.component';

describe('RuleKindChooserComponent', () => {
  let fixture: ComponentFixture<RuleKindChooserComponent>;
  let component: RuleKindChooserComponent;

  const render = (kind: RuleKind, options?: RuleKind[]): void => {
    fixture.componentRef.setInput('kind', kind);
    if (options) fixture.componentRef.setInput('options', options);
    fixture.detectChanges();
  };
  const radios = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('input[type="radio"]'));
  const labels = (): string[] =>
    Array.from<HTMLLabelElement>(fixture.nativeElement.querySelectorAll('label')).map((l) =>
      (l.textContent ?? '').trim(),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RuleKindChooserComponent] });
    fixture = TestBed.createComponent(RuleKindChooserComponent);
    component = fixture.componentInstance;
  });

  it('should be a labelled radio group offering a category rule and a merchant rule', () => {
    // act
    render('category');

    // assert & verify
    const group = fixture.nativeElement.querySelector('[role="radiogroup"]');
    expect(group?.getAttribute('aria-label')).toBe('Kind of rule');
    expect(labels()).toEqual(['Category rule', 'Merchant rule']);
  });

  it('should check the current kind only', () => {
    // act
    render('merchant');

    // assert & verify
    expect(radios().map((r) => r.checked)).toEqual([false, true]);
  });

  it('should offer Both when asked to', () => {
    // act
    render('category', ['category', 'merchant', 'both']);

    // assert & verify
    expect(labels()).toEqual(['Category rule', 'Merchant rule', 'Both']);
  });

  it('should emit the kind that is chosen', () => {
    // arrange
    const chosen = vi.fn();
    component.kindChange.subscribe(chosen);
    render('category');

    // act
    radios()[1].click();

    // assert & verify
    expect(chosen).toHaveBeenCalledWith('merchant');
  });

  it('should group the radios under one name, so the arrow keys move between them', () => {
    // act
    render('category', ['category', 'merchant', 'both']);

    // assert & verify
    const names = new Set(radios().map((r) => r.name));
    expect(names.size).toBe(1);
  });
});
