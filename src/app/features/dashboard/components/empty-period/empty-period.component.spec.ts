import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmptyPeriodComponent } from './empty-period.component';

describe('EmptyPeriodComponent', () => {
  let fixture: ComponentFixture<EmptyPeriodComponent>;

  function render(latest: { label: string; link: Record<string, string | number> } | null): void {
    fixture.componentRef.setInput('periodLabel', 'October 2026');
    fixture.componentRef.setInput('latest', latest);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyPeriodComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(EmptyPeriodComponent);
  });

  it('should say nothing was recorded for the period, in plain words', () => {
    // act
    render(null);

    // assert & verify
    const heading: string = fixture.nativeElement.querySelector('h2').textContent.trim();
    expect(heading).toBe('No income or spending in October 2026');
  });

  it('should offer a jump to the latest data when there is some', () => {
    // act
    render({ label: 'August 2026', link: { period: 'CUSTOM', month: 8, year: 2026 } });

    // assert & verify
    const text: string = fixture.nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Latest data: August 2026');
    const anchor: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(anchor.textContent?.trim()).toBe('Jump to August 2026');
    expect(anchor.getAttribute('href')).toBe('/dashboard?period=CUSTOM&month=8&year=2026');
  });

  it('should offer no jump when there is no later data to go to', () => {
    // act
    render(null);

    // assert & verify
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Latest data');
  });

  it('should not print placeholders or NaN', () => {
    // act
    render(null);

    // assert & verify
    expect(fixture.nativeElement.textContent).not.toMatch(/NaN|undefined|null/);
  });
});
