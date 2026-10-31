import { vi, Mock, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@core/services/toast.service';
import { TagApiService } from '@features/tags/services/tag-api.service';
import { Tag } from '@models/tag.model';
import { SettingsGuard } from '../settings.guard';
import { TagsComponent } from './tags.component';

const tag = (id: number, name: string, color: string | null = '#10B981'): Tag => ({
  id,
  userId: 1,
  name,
  color,
});
const trip = tag(1, 'Trip');
const apple = tag(2, 'apple', null);
const work = tag(3, 'Work', '#3B82F6');

describe('TagsComponent', () => {
  let fixture: ComponentFixture<TagsComponent>;
  let component: TagsComponent;
  let api: Mocked<Pick<TagApiService, 'getTags' | 'createTag' | 'updateTag' | 'deleteTag'>>;
  let toast: Mocked<Pick<ToastService, 'success' | 'error' | 'info'>>;
  let confirmation: { confirm: Mock<(c: Confirmation) => void> };
  let router: Mocked<Pick<Router, 'navigate'>>;
  let guard: SettingsGuard;

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(TagsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await settle();
  }
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  const rows = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-tag-row]'));
  const rowNames = (): string[] =>
    rows().map((r) => r.querySelector('[data-tag-name]')!.textContent!.trim());
  const button = (label: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.trim() === label,
    );
  const makeDirty = (): void => {
    component['tagForm']()!.form.controls.name.setValue('Changed');
    component['tagForm']()!.form.markAsDirty();
  };

  beforeEach(async () => {
    api = {
      getTags: vi.fn().mockReturnValue(of([trip, apple, work])),
      createTag: vi.fn().mockReturnValue(of(9)),
      updateTag: vi.fn().mockReturnValue(of(1)),
      deleteTag: vi.fn().mockReturnValue(of(undefined)),
    };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    confirmation = { confirm: vi.fn() };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [TagsComponent, NoopAnimationsModule],
      providers: [
        SettingsGuard,
        { provide: TagApiService, useValue: api },
        { provide: AuthService, useValue: { user: () => ({ id: 42 }) } },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmationService, useValue: confirmation },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    guard = TestBed.inject(SettingsGuard);
  });

  it('should show tags sorted by name ignoring case, as pills', async () => {
    // act
    await create();

    // assert & verify
    expect(rowNames()).toEqual(['apple', 'Trip', 'Work']);
    expect(text()).toContain('3 tags');
  });

  it('should open a tag in the panel and return to overview on Back and Close', async () => {
    // arrange
    await create();

    // act
    rows()[1].click();
    await settle();
    const opened = {
      mode: component['panelMode'](),
      title: fixture.nativeElement.querySelector('aside h2').textContent.trim(),
    };
    button('Back to overview')!.click();
    await settle();
    const afterBack = component['panelMode']();
    rows()[0].click();
    await settle();
    component.onPanelClose();
    await settle();

    // assert & verify
    expect(opened).toEqual({ mode: 'tag', title: 'Trip' });
    expect(afterBack).toBe('overview');
    expect(component['panelMode']()).toBe('overview');
  });

  it('should filter by name and say when nothing matches', async () => {
    // arrange
    await create();
    const search = (value: string): void => {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('#tags-search');
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    // act
    search('tr');
    const matched = rowNames();
    search('zzz');
    const none = text();
    button('Clear search')!.click();
    fixture.detectChanges();

    // assert & verify
    expect(matched).toEqual(['Trip']);
    expect(none).toContain('No tags match');
    expect(rows()).toHaveLength(3);
  });

  it('should save an edited tag with its id and keep it open', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();
    makeDirty();

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(api.updateTag).toHaveBeenCalledWith({ id: 1, name: 'Changed', color: '#10B981' });
    expect(toast.success).toHaveBeenCalledWith('Tag saved');
    expect(component['panelMode']()).toBe('tag');
    expect(component['selectedTagId']()).toBe(1);
    expect(guard.dirty()).toBe(false);
  });

  it('should keep the tag open after saving when the server answers an update with no id', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();
    api.updateTag.mockReturnValue(of(undefined as unknown as number));
    makeDirty();

    // act
    component.onPanelSave();
    await settle();
    component.loadTags();
    await settle();

    // assert & verify
    expect(component['selectedTagId']()).toBe(1);
    expect(component['panelMode']()).toBe('tag');
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('should not trap a phone user in a full-screen sheet when there are no tags', async () => {
    // arrange
    api.getTags.mockReturnValue(of([]));

    // act
    await create();
    const empty = fixture.nativeElement.querySelector('aside').className;
    api.getTags.mockReturnValue(of([trip, work]));
    component.loadTags();
    await settle();
    rows()[0].click();
    await settle();
    const open = fixture.nativeElement.querySelector('aside').className;

    // assert & verify
    expect(empty).not.toContain('fixed');
    expect(open).toContain('fixed');
  });

  it('should select the saved tag at once so a click during the reload is not overwritten', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();
    makeDirty();
    const reload = new Subject<Tag[]>();
    api.getTags.mockReturnValue(reload);

    // act
    component.onPanelSave();
    await settle();
    const duringReload = component['selectedTagId']();
    rows()[0].click();
    await settle();
    reload.next([trip, apple, work]);
    reload.complete();
    await settle();

    // assert & verify
    expect(duringReload).toBe(1);
    expect(component['selectedTagId']()).toBe(2);
  });

  it('should say the tag no longer exists when saving one deleted elsewhere', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();
    api.updateTag.mockReturnValue(
      throwError(() => ({ status: 403, error: { detail: 'Access Denied' } })),
    );
    api.getTags.mockReturnValue(of([apple, work]));
    makeDirty();

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(text()).not.toContain('Access Denied');
    expect(toast.info).toHaveBeenCalledWith('That tag no longer exists.');
    expect(rows()).toHaveLength(2);
  });

  it('should add a tag for the user, open it and say so', async () => {
    // arrange
    await create();
    api.getTags.mockReturnValue(of([trip, apple, work, tag(9, 'Holiday')]));
    button('Add tag')!.click();
    await settle();
    component['tagForm']()!.form.patchValue({ name: 'Holiday', color: 'aabbcc' });

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(api.createTag).toHaveBeenCalledWith({ userId: 42, name: 'Holiday', color: '#aabbcc' });
    expect(toast.success).toHaveBeenCalledWith('Tag added');
    expect(component['panelMode']()).toBe('tag');
    expect(component['selectedTagId']()).toBe(9);
  });

  it('should show the server message and stay when saving fails', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();
    api.updateTag.mockReturnValue(
      throwError(() => ({ error: { detail: 'A tag with this name already exists.' } })),
    );
    makeDirty();

    // act
    component.onPanelSave();
    await settle();

    // assert & verify
    expect(text()).toContain('A tag with this name already exists.');
    expect(component['saving']()).toBe(false);
  });

  it('should ask before discarding a dirty form on every route', async () => {
    // arrange
    await create();
    const routes: [string, () => void][] = [
      ['another row', () => rows()[2].click()],
      ['add', () => component.startAdd()],
      ['back', () => component.back()],
      ['close', () => component.onPanelClose()],
    ];

    for (const [name, go] of routes) {
      // act
      rows()[1].click();
      await settle();
      makeDirty();
      confirmation.confirm.mockClear();
      go();

      // assert & verify
      expect(confirmation.confirm, name).toHaveBeenCalledTimes(1);
      expect(confirmation.confirm.mock.calls[0][0].header).toBe('Discard changes?');
      confirmation.confirm.mock.calls[0][0].accept!();
      await settle();
      component.back();
      confirmation.confirm.mock.calls.at(-1)?.[0].accept?.();
      await settle();
    }
  });

  it('should tell the settings host when the form is dirty', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();

    // act
    const clean = guard.dirty();
    makeDirty();

    // assert & verify
    expect(clean).toBe(false);
    expect(guard.dirty()).toBe(true);
  });

  it('should ask before deleting and remove the tag', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();
    api.getTags.mockReturnValue(of([apple, work]));

    // act
    button('Delete tag')!.click();
    const asked = confirmation.confirm.mock.calls[0][0];
    asked.accept!();
    await settle();

    // assert & verify
    expect(asked.message).toContain('Trip');
    expect(api.deleteTag).toHaveBeenCalledWith(1);
    expect(toast.success).toHaveBeenCalledWith('Tag deleted');
    expect(component['panelMode']()).toBe('overview');
    expect(rows()).toHaveLength(2);
  });

  it("should show the server's message and keep the tag when delete is refused", async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();
    api.deleteTag.mockReturnValue(throwError(() => ({ error: { detail: 'Tag is in use.' } })));

    // act
    button('Delete tag')!.click();
    confirmation.confirm.mock.calls[0][0].accept!();
    await settle();

    // assert & verify
    expect(toast.error).toHaveBeenCalledWith('Tag is in use.');
    expect(component['panelMode']()).toBe('tag');
    expect(rows()).toHaveLength(3);
  });

  it('should open the tag transactions with its id for all time', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();

    // act
    button('View transactions')!.click();

    // assert & verify
    expect(router.navigate).toHaveBeenCalledWith(['/transactions'], {
      queryParams: { tagId: '1', period: 'all' },
    });
  });

  it('should block a second save while one is in flight', async () => {
    // arrange
    await create();
    const pending = new Subject<number>();
    api.updateTag.mockReturnValue(pending);

    // act
    component.saveTag({ id: 1, name: 'Trip', color: '#10B981' });
    component.saveTag({ id: 1, name: 'Trip', color: '#10B981' });

    // assert & verify
    expect(api.updateTag).toHaveBeenCalledTimes(1);
    expect(component['saving']()).toBe(true);
  });

  it('should show a skeleton on the first load and dim on a reload', async () => {
    // arrange
    const first = new Subject<Tag[]>();
    api.getTags.mockReturnValue(first);
    fixture = TestBed.createComponent(TagsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // act
    const skeleton = fixture.nativeElement.querySelector('p-skeleton');
    first.next([trip, work]);
    first.complete();
    await settle();
    api.getTags.mockReturnValue(new Subject<Tag[]>());
    component.loadTags();
    await settle();

    // assert & verify
    expect(skeleton).not.toBeNull();
    expect(fixture.nativeElement.querySelector('p-skeleton')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(rows()).toHaveLength(2);
  });

  it('should show the error state and clear stale rows when a reload fails', async () => {
    // arrange
    await create();
    api.getTags.mockReturnValue(throwError(() => new Error('boom')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // act
    component.loadTags();
    await settle();

    // assert & verify
    expect(fixture.debugElement.query(By.css('app-page-error-state'))).not.toBeNull();
    expect(component['tags']()).toEqual([]);
  });

  it('should drop a slower response from an earlier load', async () => {
    // arrange
    await create();
    const slow = new Subject<Tag[]>();
    const fast = new Subject<Tag[]>();
    api.getTags.mockReturnValueOnce(slow).mockReturnValueOnce(fast);

    // act
    component.loadTags();
    component.loadTags();
    fast.next([trip]);
    fast.complete();
    slow.next([trip, work]);
    slow.complete();
    await settle();

    // assert & verify
    expect(rows()).toHaveLength(1);
    expect(component['loading']()).toBe(false);
  });

  it('should open Add with no Back when there are no tags', async () => {
    // arrange
    api.getTags.mockReturnValue(of([]));

    // act
    await create();

    // assert & verify
    expect(component['panelMode']()).toBe('add');
    expect(text()).toContain('No tags yet');
    expect(button('Back')).toBeUndefined();
    expect(button('Close')).toBeUndefined();
  });

  it('should return to overview with a toast when the shown tag vanished', async () => {
    // arrange
    await create();
    rows()[1].click();
    await settle();
    api.getTags.mockReturnValue(of([apple, work]));

    // act
    component.loadTags();
    await settle();

    // assert & verify
    expect(component['panelMode']()).toBe('overview');
    expect(toast.info).toHaveBeenCalledWith('That tag no longer exists.');
  });

  it('should move focus into the panel and back to the opener', async () => {
    // arrange
    await create();
    document.body.appendChild(fixture.nativeElement);
    const opener = rows()[0];
    opener.focus();

    // act
    opener.click();
    await settle();
    await new Promise((resolve) => setTimeout(resolve));
    const inPanel = document.activeElement?.tagName;
    button('Back to overview')!.click();
    await settle();
    await new Promise((resolve) => setTimeout(resolve));

    // assert & verify
    expect(inPanel).toBe('ASIDE');
    expect(document.activeElement).toBe(rows()[0]);
    fixture.nativeElement.remove();
  });
});
