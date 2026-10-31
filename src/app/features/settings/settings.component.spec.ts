import { vi, Mocked } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import {
  ActivatedRoute,
  Event as RouterEvent,
  NavigationEnd,
  NavigationStart,
  Params,
  Router,
} from '@angular/router';
import { Subject } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { SettingsComponent } from './settings.component';
import { SettingsGuard } from './settings.guard';
import { CategoryRulesComponent } from './category-rules/category-rules.component';
import { TagsComponent } from './tags/tags.component';

@Component({
  selector: 'app-category-rules',
  standalone: true,
  template: '<p>rules section</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class RulesStubComponent {}
@Component({
  selector: 'app-tags',
  standalone: true,
  template: '<p>tags section</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TagsStubComponent {}

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let component: SettingsComponent;
  let router: Mocked<Pick<Router, 'navigate'>> & { events: Subject<RouterEvent> };
  let location: { back: ReturnType<typeof vi.fn>; forward: ReturnType<typeof vi.fn> };
  let confirmation: Mocked<Pick<ConfirmationService, 'confirm'>>;
  let queryParams: Subject<Params>;
  let snapshotParams: Params;

  async function create(params: Params = {}): Promise<void> {
    snapshotParams = params;
    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  const navButton = (label: string): HTMLButtonElement =>
    (Array.from(fixture.nativeElement.querySelectorAll('nav button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === label,
    )!;

  beforeEach(async () => {
    queryParams = new Subject<Params>();
    snapshotParams = {};
    router = { navigate: vi.fn().mockResolvedValue(true), events: new Subject<RouterEvent>() };
    location = { back: vi.fn(), forward: vi.fn() };
    confirmation = { confirm: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { queryParams: snapshotParams };
            },
            queryParams,
          },
        },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    })
      .overrideComponent(SettingsComponent, {
        remove: { imports: [CategoryRulesComponent, TagsComponent] },
        add: { imports: [RulesStubComponent, TagsStubComponent] },
      })
      .compileComponents();
  });

  it('should open on category rules by default', async () => {
    // act
    await create();

    // assert & verify
    expect(component.section()).toBe('rules');
    expect(text()).toContain('rules section');
    expect(text()).toContain('Settings');
  });

  it('should fall back for an unknown section and honour a known one', async () => {
    // act
    await create({ section: 'nope' });
    const fallback = component.section();
    fixture.destroy();
    await create({ section: 'tags' });

    // assert & verify
    expect(fallback).toBe('rules');
    expect(component.section()).toBe('tags');
    expect(text()).toContain('tags section');
  });

  it('should hydrate from the URL and write every change back', async () => {
    // arrange
    await create();

    // act
    navButton('Tags').click();
    await fixture.whenStable();
    fixture.detectChanges();

    // assert & verify
    expect(component.section()).toBe('tags');
    expect(router.navigate).toHaveBeenLastCalledWith([], { queryParams: { section: 'tags' } });
    expect(navButton('Tags').getAttribute('aria-current')).toBe('page');
  });

  it('should show appearance when chosen', async () => {
    // arrange
    await create();

    // act
    navButton('Appearance').click();
    fixture.detectChanges();

    // assert & verify
    expect(fixture.nativeElement.querySelector('app-appearance-settings')).not.toBeNull();
  });

  it('should follow the URL on browser back without writing it again', async () => {
    // arrange
    await create({ section: 'tags' });
    router.navigate.mockClear();

    // act
    queryParams.next({ section: 'appearance' });
    fixture.detectChanges();

    // assert & verify
    expect(component.section()).toBe('appearance');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should leave a clean section without asking', async () => {
    // arrange
    await create();
    fixture.debugElement.injector.get(SettingsGuard).register(() => false);

    // act
    navButton('Tags').click();

    // assert & verify
    expect(confirmation.confirm).not.toHaveBeenCalled();
    expect(component.section()).toBe('tags');
  });

  it('should ask before leaving a dirty section, stay when kept and leave when discarded', async () => {
    // arrange
    await create();
    fixture.debugElement.injector.get(SettingsGuard).register(() => true);

    // act
    navButton('Tags').click();
    const stayed = component.section();
    confirmation.confirm.mock.calls[0][0].accept!();

    // assert & verify
    expect(confirmation.confirm).toHaveBeenCalledTimes(1);
    expect(confirmation.confirm.mock.calls[0][0].header).toBe('Discard changes?');
    expect(stayed).toBe('rules');
    expect(component.section()).toBe('tags');
  });

  it('should put the URL back when browser back leaves a dirty section and is kept', async () => {
    // arrange
    await create({ section: 'rules' });
    fixture.debugElement.injector.get(SettingsGuard).register(() => true);
    router.navigate.mockClear();

    // act
    queryParams.next({ section: 'tags' });
    const reject = confirmation.confirm.mock.calls[0][0].reject!;
    reject();

    // assert & verify
    expect(component.section()).toBe('rules');
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: { section: 'rules' },
      replaceUrl: true,
    });
  });

  it('should let a clean page be left without asking', async () => {
    // arrange
    await create();
    fixture.debugElement.injector.get(SettingsGuard).register(() => false);

    // act
    const allowed = await component.canLeave();

    // assert & verify
    expect(allowed).toBe(true);
    expect(confirmation.confirm).not.toHaveBeenCalled();
  });

  it('should ask before leaving the page with unsaved changes and follow the answer', async () => {
    // arrange
    await create();
    fixture.debugElement.injector.get(SettingsGuard).register(() => true);

    // act
    const kept = component.canLeave();
    confirmation.confirm.mock.calls[0][0].reject!();
    const discarded = component.canLeave();
    confirmation.confirm.mock.calls[1][0].accept!();

    // assert & verify
    expect(await kept).toBe(false);
    expect(await discarded).toBe(true);
    expect(confirmation.confirm.mock.calls[0][0].header).toBe('Discard changes?');
  });

  it('should warn the browser before it unloads the page with unsaved changes', async () => {
    // arrange
    await create();
    const guard = fixture.debugElement.injector.get(SettingsGuard);
    const unload = (): Event => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event;
    };

    // act
    guard.register(() => false);
    const clean = unload();
    guard.register(() => true);
    const dirty = unload();

    // assert & verify
    expect(clean.defaultPrevented).toBe(false);
    expect(dirty.defaultPrevented).toBe(true);
  });

  // PF-890: keeping the edits after a browser Back or Forward steps the history back where it was,
  // instead of overwriting the entry (which left two entries for the same section)
  describe('keeping edits after browser Back or Forward', () => {
    const dirty = async (): Promise<void> => {
      await create({ section: 'rules' });
      fixture.debugElement.injector.get(SettingsGuard).register(() => true);
      router.events.next(
        new NavigationEnd(3, '/settings?section=rules', '/settings?section=rules'),
      );
      router.navigate.mockClear();
    };
    const pop = (restoredId: number): void => {
      router.events.next(
        new NavigationStart(9, '/settings?section=tags', 'popstate', { navigationId: restoredId }),
      );
      queryParams.next({ section: 'tags' });
    };

    it('should go forward again after Back is kept, adding no history entry', async () => {
      // arrange
      await dirty();

      // act -- Back moved to an earlier entry
      pop(2);
      confirmation.confirm.mock.calls[0][0].reject!();

      // assert & verify
      expect(location.forward).toHaveBeenCalledTimes(1);
      expect(location.back).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component.section()).toBe('rules');
    });

    it('should go back again after Forward is kept', async () => {
      // arrange
      await dirty();

      // act -- Forward moved to a later entry
      pop(4);
      confirmation.confirm.mock.calls[0][0].reject!();

      // assert & verify
      expect(location.back).toHaveBeenCalledTimes(1);
      expect(location.forward).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should leave the history alone and follow the URL when the edits are discarded', async () => {
      // arrange
      await dirty();

      // act
      pop(2);
      confirmation.confirm.mock.calls[0][0].accept!();

      // assert & verify
      expect(component.section()).toBe('tags');
      expect(location.forward).not.toHaveBeenCalled();
      expect(location.back).not.toHaveBeenCalled();
    });
  });
});
