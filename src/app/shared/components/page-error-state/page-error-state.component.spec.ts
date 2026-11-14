import { describe, it, expect, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PageErrorStateComponent } from './page-error-state.component';

describe('PageErrorStateComponent', () => {
  let fixture: ComponentFixture<PageErrorStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageErrorStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageErrorStateComponent);
  });

  it('should show a default message when none is provided', () => {
    // Act
    fixture.detectChanges();

    // Assert
    expect(fixture.nativeElement.textContent).toContain(
      'Something went wrong while loading this page.',
    );
  });

  it('should show a custom message when provided', () => {
    // Arrange
    fixture.componentRef.setInput('message', 'Failed to load accounts.');

    // Act
    fixture.detectChanges();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('Failed to load accounts.');
  });

  it('should emit retry when the Retry button is clicked', () => {
    // Arrange
    fixture.detectChanges();
    const retrySpy = vi.fn();
    fixture.componentInstance.retry.subscribe(retrySpy);

    // Act
    fixture.debugElement.query(By.css('p-button button')).nativeElement.click();

    // Assert
    expect(retrySpy).toHaveBeenCalledOnce();
  });

  it('should announce itself as an alert, reassure that data is unchanged, and stay static', () => {
    // Act
    fixture.detectChanges();

    // Assert
    const root: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(root).not.toBeNull();
    expect(root.textContent).toContain('Your data is unchanged');
    expect(root.textContent).not.toMatch(/data service|running/i);
    expect(fixture.nativeElement.innerHTML).not.toContain('animate-pulse');
    expect(
      fixture.nativeElement.querySelector('.pi-exclamation-triangle').getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('should show a Retrying state after Retry is pressed, then settle', async () => {
    // Arrange
    vi.useFakeTimers();
    fixture.detectChanges();

    // Act
    fixture.debugElement.query(By.css('p-button button')).nativeElement.click();
    fixture.detectChanges();

    // Assert
    expect(fixture.nativeElement.textContent).toContain('Retrying');

    // Act
    vi.advanceTimersByTime(900);
    fixture.detectChanges();

    // Assert
    expect(fixture.nativeElement.textContent).not.toContain('Retrying');
    vi.useRealTimers();
  });
});
