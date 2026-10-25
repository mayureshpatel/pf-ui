import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DrillBreadcrumbComponent } from './drill-breadcrumb.component';

describe('DrillBreadcrumbComponent', () => {
  let fixture: ComponentFixture<DrillBreadcrumbComponent>;

  function render(crumbs: string[]): void {
    fixture.componentRef.setInput('crumbs', crumbs);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DrillBreadcrumbComponent] });
    fixture = TestBed.createComponent(DrillBreadcrumbComponent);
  });

  it('should render crumbs and emit the index of an earlier crumb', () => {
    // arrange
    const emitted: number[] = [];
    fixture.componentInstance.stepBack.subscribe((i: number) => emitted.push(i));
    render(['All spending', 'Food', 'Groceries']);

    // act
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    buttons[1].click();
    buttons[0].click();

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('All spending');
    expect(fixture.nativeElement.textContent).toContain('Groceries');
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['All spending', 'Food']);
    expect(emitted).toEqual([1, 0]);
  });

  it('should not link the current crumb', () => {
    // act
    render(['All spending', 'Food']);

    // assert & verify
    const current: HTMLElement = fixture.nativeElement.querySelector('[aria-current="page"]');
    expect(current.textContent?.trim()).toBe('Food');
    expect(current.tagName).not.toBe('BUTTON');
  });

  it('should show only the current crumb at the start', () => {
    // act
    render(['All spending']);

    // assert & verify
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[aria-current="page"]').textContent).toContain(
      'All spending',
    );
  });
});
