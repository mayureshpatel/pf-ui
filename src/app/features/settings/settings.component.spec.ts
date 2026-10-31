import { vi, Mocked } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
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
  let router: Mocked<Pick<Router, 'navigate'>>;
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
    router = { navigate: vi.fn().mockResolvedValue(true) };
    confirmation = { confirm: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: Router, useValue: router },
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
});
