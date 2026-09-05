import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of} from 'rxjs';
import {ConfirmationService} from 'primeng/api';

import {TagsComponent} from './tags.component';
import {TagApiService} from '@features/tags/services/tag-api.service';
import {ToastService} from '@core/services/toast.service';
import {Tag} from '@models/tag.model';

describe('TagsComponent', () => {
  let component: TagsComponent;
  let fixture: ComponentFixture<TagsComponent>;
  let mockApi: any;
  let mockToast: any;
  let mockConfirmationService: any;

  const travelTag: Tag = {id: 1, userId: 1, name: 'Travel', color: '#ff6b6b'};
  const reimbursableTag: Tag = {id: 2, userId: 1, name: 'Reimbursable', color: null};

  beforeEach(async () => {
    mockApi = {
      getTags: vi.fn().mockReturnValue(of([travelTag, reimbursableTag])),
      deleteTag: vi.fn().mockReturnValue(of(undefined))
    };
    mockToast = {success: vi.fn(), error: vi.fn()};
    mockConfirmationService = {confirm: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [TagsComponent, NoopAnimationsModule],
      providers: [
        {provide: TagApiService, useValue: mockApi},
        {provide: ToastService, useValue: mockToast},
        {provide: ConfirmationService, useValue: mockConfirmationService}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TagsComponent);
    component = fixture.componentInstance;
  });

  it('should load and render tags, falling back to a neutral color for a tag with none set', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Travel');
    expect(compiled.textContent).toContain('Reimbursable');
    expect(compiled.textContent).toContain('#ff6b6b');
    expect(component.tags()).toEqual([travelTag, reimbursableTag]);
  });

  it('should show the empty state when there are no tags', () => {
    // arrange
    mockApi.getTags.mockReturnValue(of([]));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(component.isEmpty()).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No tags yet');
  });

  it('should open the dialog in create mode (no selected tag) via openCreateDialog', () => {
    // arrange
    fixture.detectChanges();
    component.selectedTag.set(travelTag);

    // act
    component.openCreateDialog();

    // assert & verify
    expect(component.showDialog()).toBe(true);
    expect(component.selectedTag()).toBeNull();
  });

  it('should open the dialog pre-set to the clicked tag via openEditDialog', () => {
    // arrange
    fixture.detectChanges();

    // act
    component.openEditDialog(travelTag);

    // assert & verify
    expect(component.showDialog()).toBe(true);
    expect(component.selectedTag()).toEqual(travelTag);
  });

  it('should reload the list when the dialog reports a successful save', () => {
    // arrange
    fixture.detectChanges();
    mockApi.getTags.mockClear();

    // act
    component.onTagSaved();

    // assert & verify
    expect(mockApi.getTags).toHaveBeenCalled();
  });

  it('should give the edit and delete buttons accessible names', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    const editButton: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-pencil)');
    const deleteButton: HTMLButtonElement = fixture.nativeElement.querySelector('button:has(.pi-trash)');
    expect(editButton.getAttribute('aria-label')).toBe('Edit tag');
    expect(deleteButton.getAttribute('aria-label')).toBe('Delete tag');
  });

  it('should confirm before deleting and mention that it also removes the tag from any transactions carrying it', () => {
    // arrange
    fixture.detectChanges();

    // act
    component.deleteTag(travelTag);

    // assert & verify
    expect(mockConfirmationService.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('removes it from any transactions currently tagged with it')
      })
    );
  });

  it('should remove the tag from the list once the confirmed delete succeeds', () => {
    // arrange
    fixture.detectChanges();
    mockConfirmationService.confirm.mockImplementation((opts: any) => opts.accept());

    // act
    component.deleteTag(travelTag);

    // assert & verify
    expect(mockApi.deleteTag).toHaveBeenCalledWith(1);
    expect(component.tags()).toEqual([reimbursableTag]);
    expect(mockToast.success).toHaveBeenCalledWith('Tag deleted.');
  });
});
