import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Transaction, TransactionType } from '@models/transaction.model';
import { GridHighlights, NO_HIGHLIGHTS } from '../../utils/grid-highlights';
import { TransactionGridToolbarComponent } from './transaction-grid-toolbar.component';

describe('TransactionGridToolbarComponent', () => {
  let fixture: ComponentFixture<TransactionGridToolbarComponent>;
  let component: TransactionGridToolbarComponent;

  const render = (selectionCount: number, highlights: GridHighlights = NO_HIGHLIGHTS): void => {
    fixture.componentRef.setInput('selectionCount', selectionCount);
    fixture.componentRef.setInput('highlights', highlights);
    fixture.detectChanges();
  };
  const switchNamed = (name: string): HTMLButtonElement | undefined =>
    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('[role="switch"]')).find(
      (b) => b.textContent?.trim().startsWith(name),
    );
  const createRule = (): HTMLButtonElement | null =>
    fixture.nativeElement.querySelector('[data-testid="toolbar-create-rule"]');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionGridToolbarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TransactionGridToolbarComponent);
    component = fixture.componentInstance;
  });

  it('should be a labelled toolbar with a Create rule button', () => {
    // act
    render(0);

    // assert & verify
    const toolbar: HTMLElement = fixture.nativeElement.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar.getAttribute('aria-label')).toBe('Grid tools');
    expect(createRule()?.textContent?.trim()).toBe('Create rule');
  });

  it('should disable Create rule with nothing ticked, and say why in visible text', () => {
    // act
    render(0);

    // assert & verify
    expect(createRule()?.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Select rows to create a rule');
  });

  it('should enable Create rule once a row is ticked, and drop the hint', () => {
    // act
    render(1);

    // assert & verify
    expect(createRule()?.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Select rows to create a rule');
  });

  it('should emit createRule when Create rule is clicked with rows ticked', () => {
    // arrange
    const created = vi.fn();
    component.createRule.subscribe(created);
    render(3);

    // act
    createRule()?.click();

    // assert & verify
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('should not emit when Create rule is clicked with nothing ticked', () => {
    // arrange
    const created = vi.fn();
    component.createRule.subscribe(created);
    render(0);

    // act
    createRule()?.click();

    // assert & verify
    expect(created).not.toHaveBeenCalled();
  });

  describe('highlight switches', () => {
    it('should offer No category and No merchant, both off by default', () => {
      // act
      render(0);

      // assert & verify
      expect(switchNamed('No category')?.getAttribute('aria-checked')).toBe('false');
      expect(switchNamed('No merchant')?.getAttribute('aria-checked')).toBe('false');
    });

    it('should offer Rule covers it as a third switch, off by default', () => {
      // act
      render(0);

      // assert & verify
      expect(switchNamed('Rule covers it')?.getAttribute('aria-checked')).toBe('false');
    });

    it('should turn Rule covers it on together with the others', () => {
      // arrange
      const changed = vi.fn();
      component.highlightsChange.subscribe(changed);
      render(0, { noCategory: true, noMerchant: false, ruleCovers: false });

      // act
      switchNamed('Rule covers it')?.click();

      // assert & verify
      expect(changed).toHaveBeenCalledWith({
        noCategory: true,
        noMerchant: false,
        ruleCovers: true,
      });
    });

    it('should reflect the current highlights in each switch', () => {
      // act
      render(0, { noCategory: true, noMerchant: false, ruleCovers: false });

      // assert & verify
      expect(switchNamed('No category')?.getAttribute('aria-checked')).toBe('true');
      expect(switchNamed('No merchant')?.getAttribute('aria-checked')).toBe('false');
    });

    it('should emit the new highlights when a switch is toggled, keeping the others as they were', () => {
      // arrange
      const changed = vi.fn();
      component.highlightsChange.subscribe(changed);
      render(0, { noCategory: true, noMerchant: false, ruleCovers: false });

      // act
      switchNamed('No merchant')?.click();

      // assert & verify -- combinable: turning one on leaves the other on
      expect(changed).toHaveBeenCalledWith({
        noCategory: true,
        noMerchant: true,
        ruleCovers: false,
      });
    });

    it('should turn a switch off again', () => {
      // arrange
      const changed = vi.fn();
      component.highlightsChange.subscribe(changed);
      render(0, { noCategory: true, noMerchant: true, ruleCovers: false });

      // act
      switchNamed('No category')?.click();

      // assert & verify
      expect(changed).toHaveBeenCalledWith({
        noCategory: false,
        noMerchant: true,
        ruleCovers: false,
      });
    });

    it('should keep the switches usable whether or not rows are ticked', () => {
      // act
      render(2);

      // assert & verify
      expect(switchNamed('No category')?.disabled).toBe(false);
    });
  });
  describe('active highlight cues', () => {
    const rows = [
      { id: 1, type: TransactionType.EXPENSE, category: null, merchant: null },
      { id: 2, type: TransactionType.EXPENSE, category: 'Food', merchant: 'Shop' },
      { id: 3, type: TransactionType.TRANSFER, category: null, merchant: null },
    ] as unknown as Transaction[];

    it('should show a check and the page count on an active switch, not only a colour', () => {
      // arrange
      fixture.componentRef.setInput('transactions', rows);

      // act
      render(0, { noCategory: true, noMerchant: false, ruleCovers: false });

      // assert & verify -- the transfer has no category by design, so it is not counted
      const active = switchNamed('No category') as HTMLButtonElement;
      expect(active.querySelector('.pi-check')).not.toBeNull();
      expect(active.textContent).toContain('(1)');
      expect(
        (switchNamed('No merchant') as HTMLButtonElement).querySelector('.pi-check'),
      ).toBeNull();
    });
  });

  describe('phone disclosure', () => {
    it('should keep the tools behind one 44px control until it is opened', () => {
      // arrange
      render(0);
      const toggle = fixture.nativeElement.querySelector(
        '[data-testid="toolbar-toggle"]',
      ) as HTMLButtonElement;
      const tools = fixture.nativeElement.querySelector('#grid-tools') as HTMLElement;

      // assert & verify
      expect(toggle.className).toContain('min-h-11');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(tools.classList).toContain('hidden');

      // act
      toggle.click();
      fixture.detectChanges();

      // assert & verify
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(tools.classList).not.toContain('hidden');
    });
  });
});
