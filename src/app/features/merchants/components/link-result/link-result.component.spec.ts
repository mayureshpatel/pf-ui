import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LastLink, UndoOutcome } from '../../utils/link-helpers';
import { LinkResultComponent } from './link-result.component';

const link: LastLink = { merchantName: 'Kroger', linked: 11, filled: 205, results: [] };

describe('LinkResultComponent', () => {
  let fixture: ComponentFixture<LinkResultComponent>;
  let events: string[];

  const el = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);
  const render = (
    undoing = false,
    undone: UndoOutcome | null = null,
    shown: LastLink | null = link,
  ): void => {
    fixture.componentRef.setInput('link', shown);
    fixture.componentRef.setInput('undoing', undoing);
    fixture.componentRef.setInput('undone', undone);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LinkResultComponent] }).compileComponents();
    fixture = TestBed.createComponent(LinkResultComponent);
    events = [];
    fixture.componentInstance.undo.subscribe(() => events.push('undo'));
    fixture.componentInstance.dismiss.subscribe(() => events.push('dismiss'));
  });

  it('should announce what was linked and offer Undo', () => {
    // act
    render();
    (el('[data-testid="link-result-undo"]') as HTMLButtonElement).click();
    (el('[data-testid="link-result-dismiss"]') as HTMLButtonElement).click();

    // assert & verify
    expect(el('[role="status"]')?.textContent?.trim()).toBe(
      'Linked 11 to Kroger · 205 transactions filled',
    );
    expect(el('[data-testid="link-result-dismiss"]')?.getAttribute('aria-label')).toBe('Dismiss');
    expect(events).toEqual(['undo', 'dismiss']);
  });

  it('should keep an empty live region and no line when there is no link', () => {
    // act
    render(false, null, null);

    // assert & verify
    expect(el('[role="status"]')?.textContent?.trim()).toBe('');
    expect(el('[data-testid="link-result"]')).toBeNull();
  });

  it('should disable Undo while it runs', () => {
    // act
    render(true);

    // assert & verify
    const undo = el('[data-testid="link-result-undo"]') as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect(undo.textContent?.trim()).toBe('Undoing…');
  });

  it('should report the undo and stop offering it', () => {
    // act
    render(false, { restored: 216, skipped: 2, failed: false });

    // assert & verify
    expect(el('[role="status"]')?.textContent?.trim()).toBe(
      'Link undone · 2 changed since and were kept',
    );
    expect(el('[data-testid="link-result-undo"]')).toBeNull();
  });
});
