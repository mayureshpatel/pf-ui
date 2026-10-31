import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tag } from '@models/tag.model';
import { TagEditFormComponent } from './tag-edit-form.component';

const trip: Tag = { id: 4, userId: 1, name: 'Trip', color: '#10B981' };

describe('TagEditFormComponent', () => {
  let fixture: ComponentFixture<TagEditFormComponent>;
  let component: TagEditFormComponent;
  let saved: unknown[];
  let removed: number;
  let viewed: number;

  function render(tag: Tag | null = null, saving = false): void {
    fixture = TestBed.createComponent(TagEditFormComponent);
    component = fixture.componentInstance;
    saved = [];
    removed = 0;
    viewed = 0;
    component.save.subscribe((v) => saved.push(v));
    component.remove.subscribe(() => removed++);
    component.viewTransactions.subscribe(() => viewed++);
    fixture.componentRef.setInput('tag', tag);
    fixture.componentRef.setInput('saving', saving);
    fixture.detectChanges();
  }

  const buttonByText = (text: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent?.includes(text),
    );

  beforeEach(() => TestBed.configureTestingModule({ imports: [TagEditFormComponent] }));

  it('should default to an empty name and the default colour', () => {
    // act
    render();

    // assert & verify
    expect(component.form.getRawValue()).toEqual({ name: '', color: '3b82f6' });
  });

  it('should prefill an existing tag without the leading #', () => {
    // act
    render(trip);

    // assert & verify
    expect(component.form.getRawValue()).toEqual({ name: 'Trip', color: '10B981' });
    expect(component.form.pristine).toBe(true);
  });

  it('should keep a tag without a colour colourless when only the name changes', () => {
    // arrange
    render({ ...trip, color: null });
    component.form.controls.name.setValue('Trips');

    // act
    component.submit();

    // assert & verify
    expect(component.form.controls.color.value).toBe('');
    expect(saved).toEqual([{ id: 4, name: 'Trips', color: null }]);
    expect(component.previewColor()).toBe('#94a3b8');
  });

  it('should accept an empty colour and a stored 3-digit colour', () => {
    // act
    render({ ...trip, color: '#abc' });

    // assert & verify
    expect(component.form.controls.color.value).toBe('aabbcc');
    expect(component.form.valid).toBe(true);
    component.form.controls.color.setValue('');
    expect(component.form.controls.color.valid).toBe(true);
  });

  it('should take a pasted # in its stride', () => {
    // arrange
    render();

    // act
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#tag-color');
    input.value = '#3B82F6';
    input.dispatchEvent(new Event('input'));

    // assert & verify
    expect(component.form.controls.color.value).toBe('3B82F6');
  });

  it('should refill and become pristine when another tag is shown', () => {
    // arrange
    render(trip);
    component.form.controls.name.setValue('Changed');
    component.form.markAsDirty();

    // act
    fixture.componentRef.setInput('tag', { ...trip, id: 5, name: 'Work' });
    fixture.detectChanges();

    // assert & verify
    expect(component.form.getRawValue().name).toBe('Work');
    expect(component.form.pristine).toBe(true);
  });

  it('should require a name and cap it at 50 characters', () => {
    // arrange
    render();

    // act
    component.form.controls.name.setValue('   ');
    const blank = component.form.controls.name.valid;
    component.form.controls.name.setValue('a'.repeat(51));
    const long = component.form.controls.name.valid;
    component.form.controls.name.setValue('a'.repeat(50));

    // assert & verify
    expect(blank).toBe(false);
    expect(long).toBe(false);
    expect(component.form.controls.name.valid).toBe(true);
  });

  it('should reject an invalid hex colour and say so', () => {
    // arrange
    render();

    // act
    component.form.controls.color.setValue('12345');
    const short = component.form.controls.color.valid;
    component.form.controls.color.setValue('zzzzzz');
    component.form.controls.color.markAsTouched();
    fixture.detectChanges();
    const message = fixture.nativeElement.textContent;
    component.form.controls.color.setValue('aBc123');

    // assert & verify
    expect(short).toBe(false);
    expect(message).toContain('Enter a 6-digit hex colour');
    expect(component.form.controls.color.valid).toBe(true);
  });

  it('should choose a swatch', () => {
    // arrange
    render();

    // act
    (fixture.nativeElement.querySelector('[data-swatch="1"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    // assert & verify
    expect(component.form.controls.color.value).toBe('10B981');
    expect(component.form.dirty).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-swatch="1"]').getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('should trim the name and send the colour with a leading #', () => {
    // arrange
    render();
    component.form.patchValue({ name: '  Holiday ', color: 'aBc123' });

    // act
    component.submit();

    // assert & verify
    expect(saved).toEqual([{ name: 'Holiday', color: '#aBc123' }]);
  });

  it('should emit the update shape with the id in edit mode', () => {
    // arrange
    render(trip);
    component.form.controls.name.setValue('Trips');

    // act
    component.submit();

    // assert & verify
    expect(saved).toEqual([{ id: 4, name: 'Trips', color: '#10B981' }]);
  });

  it('should not emit while saving or when invalid', () => {
    // arrange
    render(trip, true);

    // act
    component.submit();
    render();
    component.submit();

    // assert & verify
    expect(saved).toEqual([]);
    expect(component.form.controls.name.touched).toBe(true);
  });

  it('should show the server message', () => {
    // arrange
    render(trip);

    // act
    component.errorMessage.set('A tag with this name already exists.');
    fixture.detectChanges();

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('A tag with this name already exists.');
  });

  it('should only offer View transactions and Delete in edit mode', () => {
    // act
    render();
    const add = fixture.nativeElement.textContent;
    render(trip);
    buttonByText('View transactions')!.click();
    buttonByText('Delete tag')!.click();

    // assert & verify
    expect(add).not.toContain('View transactions');
    expect(add).not.toContain('Delete tag');
    expect(viewed).toBe(1);
    expect(removed).toBe(1);
  });
});
