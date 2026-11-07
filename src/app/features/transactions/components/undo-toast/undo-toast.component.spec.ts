import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndoToastComponent } from './undo-toast.component';

describe('UndoToastComponent', () => {
  let fixture: ComponentFixture<UndoToastComponent>;
  let component: UndoToastComponent;

  const render = (message: string | null, lifeMs?: number): void => {
    fixture.componentRef.setInput('message', message);
    if (lifeMs !== undefined) fixture.componentRef.setInput('lifeMs', lifeMs);
    fixture.detectChanges();
  };
  const toast = (): HTMLElement | null =>
    fixture.nativeElement.querySelector('[data-testid="undo-toast"]');
  const undoButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-testid="undo-button"]');

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ imports: [UndoToastComponent] });
    fixture = TestBed.createComponent(UndoToastComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show nothing without a message, inside an always-present polite live region', () => {
    // act
    render(null);

    // assert & verify
    expect(toast()).toBeNull();
    const region = fixture.nativeElement.querySelector('[role="status"]');
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });

  it('should show the message with an Undo button', () => {
    // act
    render('Rule added. 12 transactions updated.');

    // assert & verify
    expect(toast()?.textContent).toContain('Rule added. 12 transactions updated.');
    expect(undoButton().textContent?.trim()).toBe('Undo');
  });

  it('should emit undo when Undo is pressed', () => {
    // arrange
    const undone = vi.fn();
    component.undo.subscribe(undone);
    render('Rule added.');

    // act
    undoButton().click();

    // assert & verify
    expect(undone).toHaveBeenCalledTimes(1);
  });

  it('should dismiss itself after its life when nothing is holding it open', () => {
    // arrange
    const dismissed = vi.fn();
    component.dismissed.subscribe(dismissed);
    render('Rule added.', 10000);

    // act
    vi.advanceTimersByTime(9999);
    expect(dismissed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    // assert & verify
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('should stay while it has keyboard focus, and start its countdown again once focus leaves', () => {
    // arrange
    const dismissed = vi.fn();
    component.dismissed.subscribe(dismissed);
    render('Rule added.', 10000);

    // act -- focus the Undo button, wait well past the life
    toast()!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    vi.advanceTimersByTime(60000);

    // assert & verify
    expect(dismissed).not.toHaveBeenCalled();

    // act -- focus leaves for somewhere outside the toast
    toast()!.dispatchEvent(
      new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }),
    );
    fixture.detectChanges();
    vi.advanceTimersByTime(9999);
    expect(dismissed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    // assert & verify
    expect(dismissed).toHaveBeenCalledTimes(1);
  });

  it('should stay while the pointer is over it', () => {
    // arrange
    const dismissed = vi.fn();
    component.dismissed.subscribe(dismissed);
    render('Rule added.', 10000);

    // act
    toast()!.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    vi.advanceTimersByTime(60000);

    // assert & verify
    expect(dismissed).not.toHaveBeenCalled();
  });

  it('should start its life again when a new message replaces the old one', () => {
    // arrange
    const dismissed = vi.fn();
    component.dismissed.subscribe(dismissed);
    render('First.', 10000);
    vi.advanceTimersByTime(8000);

    // act
    render('Second.', 10000);
    vi.advanceTimersByTime(8000);

    // assert & verify -- 16 seconds in, but the second message has had only 8
    expect(dismissed).not.toHaveBeenCalled();
  });

  it('should emit dismissed when the close button is pressed', () => {
    // arrange
    const dismissed = vi.fn();
    component.dismissed.subscribe(dismissed);
    render('Rule added.');

    // act
    fixture.nativeElement.querySelector('[data-testid="undo-dismiss"]').click();

    // assert & verify
    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});
