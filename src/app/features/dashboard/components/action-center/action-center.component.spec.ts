import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';

import {ActionCenterComponent} from './action-center.component';
import {ActionItem, ActionType} from '@models/dashboard.model';

describe('ActionCenterComponent', () => {
  let component: ActionCenterComponent;
  let fixture: ComponentFixture<ActionCenterComponent>;

  const mockItems: ActionItem[] = [
    {type: ActionType.UNCATEGORIZED, count: 3, message: 'Review uncategorized transactions'}
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionCenterComponent, NoopAnimationsModule],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ActionCenterComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', mockItems);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('keyboard accessibility (PF-207)', () => {
    it('should render each action item as a real, natively-focusable button', () => {
      // assert & verify -- a real <button> is part of the tab order by default, unlike a
      // <div> with no tabindex; no synthetic keyboard event can prove native Enter/Space
      // activation (untrusted events don't get default-action translation), so the meaningful
      // assertion is that the element itself is one the browser already knows how to focus
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
      expect(button).toBeTruthy();
      expect(button.textContent).toContain('Review uncategorized transactions');
    });

    it('should still call onAction on click after the conversion', () => {
      // arrange
      const onActionSpy = vi.spyOn(component, 'onAction');
      const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

      // act
      button.click();

      // assert & verify
      expect(onActionSpy).toHaveBeenCalledWith(mockItems[0]);
    });
  });
});
