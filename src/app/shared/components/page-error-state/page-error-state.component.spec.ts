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
});
