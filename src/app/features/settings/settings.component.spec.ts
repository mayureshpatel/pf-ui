import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {of} from 'rxjs';
import {ConfirmationService} from 'primeng/api';
import {SettingsComponent} from './settings.component';
import {CategoryRuleApiService} from './category-rules/services/category-rule-api.service';
import {TagApiService} from '@features/tags/services/tag-api.service';
import {ToastService} from '@core/services/toast.service';
import {CategoryRulesComponent} from './category-rules/category-rules.component';
import {TagsComponent} from './tags/tags.component';

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;

  // p-tabs' TabList calls ngAfterViewInit -> bindResizeObserver(), which JSDOM doesn't implement.
  beforeAll(() => {
    (globalThis as any).ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        {provide: CategoryRuleApiService, useValue: {getRules: vi.fn().mockReturnValue(of([]))}},
        {provide: TagApiService, useValue: {getTags: vi.fn().mockReturnValue(of([]))}},
        {provide: ToastService, useValue: {success: vi.fn(), error: vi.fn(), info: vi.fn()}},
        {provide: ConfirmationService, useValue: {confirm: vi.fn()}}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
  });

  // Neither <p-tabpanel> sets [lazy]="true", so both panels mount immediately and only toggle
  // the native `hidden` attribute -- both child components exist in the tree at all times.
  const panels = (): any[] => fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-tabpanel');
  const tabHeaders = (): any[] => fixture.debugElement.queryAll((de: any): boolean => de.name === 'p-tab');

  it('should create', () => {
    fixture.detectChanges();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should default to the Category Rules tab active and Tags hidden', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(panels()[0].nativeElement.hidden).toBe(false);
    expect(panels()[1].nativeElement.hidden).toBe(true);
  });

  it('should render both section components immediately since neither tab is lazy', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(fixture.debugElement.query(By.directive(CategoryRulesComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TagsComponent))).toBeTruthy();
  });

  it('should switch to the Tags tab and hide the Category Rules panel when its header is clicked', () => {
    // arrange
    fixture.detectChanges();

    // act
    tabHeaders()[1].nativeElement.click();
    fixture.detectChanges();

    // assert & verify
    expect(panels()[0].nativeElement.hidden).toBe(true);
    expect(panels()[1].nativeElement.hidden).toBe(false);
  });

  it('should switch back to Category Rules when its header is clicked again', () => {
    // arrange
    fixture.detectChanges();
    tabHeaders()[1].nativeElement.click();
    fixture.detectChanges();

    // act
    tabHeaders()[0].nativeElement.click();
    fixture.detectChanges();

    // assert & verify
    expect(panels()[0].nativeElement.hidden).toBe(false);
    expect(panels()[1].nativeElement.hidden).toBe(true);
  });
});
