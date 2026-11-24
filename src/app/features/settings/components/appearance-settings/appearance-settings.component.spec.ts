import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '@core/services/theme.service';
import { AppearanceSettingsComponent } from './appearance-settings.component';

describe('AppearanceSettingsComponent', () => {
  let fixture: ComponentFixture<AppearanceSettingsComponent>;
  let theme: ThemeService;

  const radios = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('input[type="radio"]'));

  beforeEach(() => {
    document.documentElement.classList.remove('my-app-dark');
    localStorage.removeItem('pf_dark_mode');
    localStorage.removeItem('pf_theme');
    TestBed.configureTestingModule({ imports: [AppearanceSettingsComponent] });
    theme = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(AppearanceSettingsComponent);
  });

  it('should be a labelled radio group with Light, Dark and System', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(
      fixture.nativeElement.querySelector('[role="radiogroup"]').getAttribute('aria-label'),
    ).toBe('Theme');
    expect(fixture.nativeElement.textContent).toContain('Light');
    expect(fixture.nativeElement.textContent).toContain('Dark');
    expect(fixture.nativeElement.textContent).toContain('System');
    expect(radios()).toHaveLength(3);
  });

  it('should check the current theme', () => {
    // arrange
    theme.setDarkMode(true);

    // act
    fixture.detectChanges();

    // assert & verify
    expect(radios().map((r) => r.checked)).toEqual([false, true, false]);
  });

  it('should switch the theme and persist it', () => {
    // arrange
    const spy = vi.spyOn(theme, 'setMode');
    fixture.detectChanges();

    // act
    radios()[1].click();
    fixture.detectChanges();

    // assert & verify
    expect(spy).toHaveBeenCalledWith('dark');
    expect(localStorage.getItem('pf_dark_mode')).toBe('true');
    expect(radios().map((r) => r.checked)).toEqual([false, true, false]);

    // act
    radios()[0].click();
    expect(spy).toHaveBeenLastCalledWith('light');
  });

  it('should mark the chosen card with a check, not only a border colour', () => {
    // arrange
    theme.setMode('system');

    // act
    fixture.detectChanges();

    // assert & verify
    expect(fixture.nativeElement.querySelectorAll('[data-selected]')).toHaveLength(1);
    expect(radios()[2].checked).toBe(true);
  });

  it('should choose System and announce the change', () => {
    // arrange
    theme.setMode('light');
    fixture.detectChanges();

    // act
    radios()[2].click();
    fixture.detectChanges();

    // assert & verify
    expect(theme.mode()).toBe('system');
    expect(
      fixture.nativeElement.querySelector('[data-testid="theme-announcement"]').textContent,
    ).toContain('Theme set to System.');
  });
});
