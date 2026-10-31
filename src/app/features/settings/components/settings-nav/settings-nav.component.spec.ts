import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsSection } from '../../utils/settings-helpers';
import { SettingsNavComponent } from './settings-nav.component';

describe('SettingsNavComponent', () => {
  let fixture: ComponentFixture<SettingsNavComponent>;

  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('nav button'));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SettingsNavComponent] });
    fixture = TestBed.createComponent(SettingsNavComponent);
    fixture.componentRef.setInput('section', 'tags');
    fixture.detectChanges();
  });

  it('should list the three sections in a labelled nav', () => {
    // assert & verify
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-label')).toBe(
      'Settings sections',
    );
    expect(buttons().map((b) => b.textContent?.trim())).toEqual([
      'Appearance',
      'Category rules',
      'Tags',
    ]);
  });

  it('should mark the active section with aria-current', () => {
    // assert & verify
    expect(buttons().map((b) => b.getAttribute('aria-current'))).toEqual([null, null, 'page']);
  });

  it('should emit the chosen section', () => {
    // arrange
    const chosen: SettingsSection[] = [];
    fixture.componentInstance.sectionChange.subscribe((s: SettingsSection) => chosen.push(s));

    // act
    buttons()[0].click();
    buttons()[1].click();

    // assert & verify
    expect(chosen).toEqual(['appearance', 'rules']);
  });
});
