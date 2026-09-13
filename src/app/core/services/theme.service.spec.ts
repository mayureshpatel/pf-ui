import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('my-app-dark');
    localStorage.removeItem('pf_dark_mode');
  });

  it('should read the initial value from the DOM class, not assume light mode', () => {
    // Arrange -- simulate index.html's inline bootstrap script already having run
    document.documentElement.classList.add('my-app-dark');

    // Act
    const service = new ThemeService();

    // Assert
    expect(service.isDarkMode()).toBe(true);
  });

  it('should default to false when the DOM class is absent', () => {
    // Arrange & Act
    const service = new ThemeService();

    // Assert
    expect(service.isDarkMode()).toBe(false);
  });

  it('should add the my-app-dark class and persist true when enabling dark mode', () => {
    // Arrange
    const service = new ThemeService();

    // Act
    service.setDarkMode(true);

    // Assert
    expect(document.documentElement.classList.contains('my-app-dark')).toBe(true);
    expect(localStorage.getItem('pf_dark_mode')).toBe('true');
    expect(service.isDarkMode()).toBe(true);
  });

  it('should remove the my-app-dark class and persist false when disabling dark mode', () => {
    // Arrange
    document.documentElement.classList.add('my-app-dark');
    const service = new ThemeService();

    // Act
    service.setDarkMode(false);

    // Assert
    expect(document.documentElement.classList.contains('my-app-dark')).toBe(false);
    expect(localStorage.getItem('pf_dark_mode')).toBe('false');
    expect(service.isDarkMode()).toBe(false);
  });
});
