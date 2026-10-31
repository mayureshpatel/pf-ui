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
    TestBed.configureTestingModule({ imports: [AppearanceSettingsComponent] });
    theme = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(AppearanceSettingsComponent);
  });

  it('should be a labelled radio group with Light and Dark', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(
      fixture.nativeElement.querySelector('[role="radiogroup"]').getAttribute('aria-label'),
    ).toBe('Theme');
    expect(fixture.nativeElement.textContent).toContain('Light');
    expect(fixture.nativeElement.textContent).toContain('Dark');
    expect(radios()).toHaveLength(2);
  });

  it('should check the current theme', () => {
    // arrange
    theme.setDarkMode(true);

    // act
    fixture.detectChanges();

    // assert & verify
    expect(radios().map((r) => r.checked)).toEqual([false, true]);
  });

  it('should switch the theme and persist it', () => {
    // arrange
    const spy = vi.spyOn(theme, 'setDarkMode');
    fixture.detectChanges();

    // act
    radios()[1].click();
    fixture.detectChanges();

    // assert & verify
    expect(spy).toHaveBeenCalledWith(true);
    expect(localStorage.getItem('pf_dark_mode')).toBe('true');
    expect(radios().map((r) => r.checked)).toEqual([false, true]);

    // act
    radios()[0].click();
    expect(spy).toHaveBeenLastCalledWith(false);
  });
});
