import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScreenToolbarComponent } from './screen-toolbar';

/** A long title block and a wide filter control, like the dashboard's subtitle and period presets. */
@Component({
  selector: 'app-toolbar-host',
  standalone: true,
  imports: [ScreenToolbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="frame" style="width: 755px">
      <app-screen-toolbar>
        <div toolbarTitle data-testid="title" style="width: 599px">Title and a long subtitle</div>
        <div toolbarFilters data-testid="filters" style="width: 384px">Filters</div>
      </app-screen-toolbar>
    </div>
  `,
})
class ToolbarHostComponent {}

describe('ScreenToolbarComponent', () => {
  let fixture: ComponentFixture<ToolbarHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ToolbarHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(ToolbarHostComponent);
    fixture.detectChanges();
  });

  /** jsdom has no layout engine, so the width checks only mean something in a real browser. */
  function hasLayout(): boolean {
    const probe: HTMLDivElement = document.createElement('div');
    probe.style.cssText = 'position:absolute;width:100px;height:10px';
    document.body.appendChild(probe);
    const laidOut: boolean = probe.offsetWidth === 100;
    probe.remove();
    return laidOut;
  }

  function rightEdge(testId: string): number {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`).getBoundingClientRect()
      .right;
  }

  it('should project the title and filters', () => {
    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('Title and a long subtitle');
    expect(fixture.nativeElement.textContent).toContain('Filters');
  });

  it('should wrap the filters below a long title instead of running past the edge at a wide viewport', async () => {
    // arrange
    if (!hasLayout()) {
      return;
    }
    const { page } = await import('vitest/browser');
    await page.viewport(1100, 800);

    // act
    fixture.detectChanges();

    // assert & verify -- 599px + 384px cannot share a 755px row, so the filters must drop a line
    expect(rightEdge('filters')).toBeLessThanOrEqual(rightEdge('frame') + 1);
  });
});
