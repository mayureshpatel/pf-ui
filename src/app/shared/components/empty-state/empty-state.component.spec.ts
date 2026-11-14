import { ChangeDetectionStrategy, Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent],
  template: `<app-empty-state title="No accounts yet" description="Add one to start."
    ><button type="button">Add</button></app-empty-state
  >`,
})
class HostComponent {}

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent],
  template: `<app-empty-state title="Nothing here" />`,
})
class BareHostComponent {}

describe('EmptyStateComponent', () => {
  it('should be a polite status region with a heading, a purpose line and projected actions', () => {
    // arrange
    const fixture = TestBed.createComponent(HostComponent);

    // act
    fixture.detectChanges();

    // assert & verify
    const root: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
    expect(root).not.toBeNull();
    expect(root.querySelector('h2')?.textContent).toContain('No accounts yet');
    expect(root.textContent).toContain('Add one to start.');
    expect(root.querySelector('button')?.textContent).toContain('Add');
  });

  it('should render no description paragraph when none is given', () => {
    // arrange
    const fixture = TestBed.createComponent(BareHostComponent);

    // act
    fixture.detectChanges();

    // assert & verify
    expect(fixture.nativeElement.querySelector('p')).toBeNull();
  });
});
