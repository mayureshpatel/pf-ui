import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of, throwError} from 'rxjs';

import {TagFormDialogComponent} from './tag-form-dialog.component';
import {TagApiService} from '@features/tags/services/tag-api.service';
import {AuthService} from '@core/auth/auth.service';
import {ToastService} from '@core/services/toast.service';
import {Tag} from '@models/tag.model';

describe('TagFormDialogComponent', () => {
  let component: TagFormDialogComponent;
  let fixture: ComponentFixture<TagFormDialogComponent>;
  let mockTagApi: any;
  let mockAuthService: any;
  let mockToast: any;

  const existingTag: Tag = {id: 5, userId: 1, name: 'Travel', color: '#ff6b6b'};

  beforeEach(async () => {
    mockTagApi = {
      createTag: vi.fn().mockReturnValue(of(9)),
      updateTag: vi.fn().mockReturnValue(of(1))
    };
    mockAuthService = {user: vi.fn().mockReturnValue({id: 1, username: 'test'})};
    mockToast = {success: vi.fn(), error: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [TagFormDialogComponent, NoopAnimationsModule],
      providers: [
        {provide: TagApiService, useValue: mockTagApi},
        {provide: AuthService, useValue: mockAuthService},
        {provide: ToastService, useValue: mockToast}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TagFormDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', false);
  });

  it('should create', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component).toBeTruthy();
  });

  it('should default to an empty name and the default color in create mode', () => {
    // act
    component.visible.set(true);
    fixture.detectChanges();

    // assert & verify
    expect(component.isEditMode()).toBe(false);
    expect(component.form.controls.name.value).toBe('');
    expect(component.form.controls.color.value).toBe('3b82f6');
  });

  it("should pre-fill the form with the tag's name and color (stripped of '#') when editing", () => {
    // act
    fixture.componentRef.setInput('tag', existingTag);
    component.visible.set(true);
    fixture.detectChanges();

    // assert & verify
    expect(component.isEditMode()).toBe(true);
    expect(component.form.controls.name.value).toBe('Travel');
    expect(component.form.controls.color.value).toBe('ff6b6b');
  });

  it('should mark name invalid when blank', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();

    // act
    component.form.controls.name.setValue('');

    // assert & verify
    expect(component.form.invalid).toBe(true);
  });

  it("should call createTag with the authenticated user's id and the '#'-prefixed color when creating", () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.form.setValue({name: 'Reimbursable', color: '00ff00'});

    // act
    component.onSubmit();

    // assert & verify
    expect(mockTagApi.createTag).toHaveBeenCalledWith({userId: 1, name: 'Reimbursable', color: '#00ff00'});
  });

  it("should call updateTag with the tag's id and the '#'-prefixed color when editing", () => {
    // arrange
    fixture.componentRef.setInput('tag', existingTag);
    component.visible.set(true);
    fixture.detectChanges();
    component.form.setValue({name: 'Travel Updated', color: '123456'});

    // act
    component.onSubmit();

    // assert & verify
    expect(mockTagApi.updateTag).toHaveBeenCalledWith({id: 5, name: 'Travel Updated', color: '#123456'});
    expect(mockTagApi.createTag).not.toHaveBeenCalled();
  });

  it('should emit save, toast success, and close the dialog once the save succeeds', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.form.controls.name.setValue('Reimbursable');
    const saveSpy = vi.fn();
    component.save.subscribe(saveSpy);

    // act
    component.onSubmit();

    // assert & verify
    expect(saveSpy).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('Tag created');
    expect(component.visible()).toBe(false);
  });

  it('should show an error message and keep the dialog open when the save fails', () => {
    // arrange
    mockTagApi.createTag.mockReturnValue(throwError(() => ({error: {detail: 'A tag with this name already exists.'}})));
    component.visible.set(true);
    fixture.detectChanges();
    component.form.controls.name.setValue('Duplicate');

    // act
    component.onSubmit();

    // assert & verify
    expect(component.errorMessage()).toBe('A tag with this name already exists.');
    expect(component.visible()).toBe(true);
  });

  it('should not call the API when the form is invalid', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.form.controls.name.setValue('');

    // act
    component.onSubmit();

    // assert & verify
    expect(mockTagApi.createTag).not.toHaveBeenCalled();
    expect(mockTagApi.updateTag).not.toHaveBeenCalled();
  });
});
