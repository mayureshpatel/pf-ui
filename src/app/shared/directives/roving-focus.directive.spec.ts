import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RovingFocusDirective } from './roving-focus.directive';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RovingFocusDirective],
  template: `
    <div appRovingFocus>
      <button type="button" id="a">A</button>
      <button type="button" id="b">B</button>
      <button type="button" id="c">C</button>
    </div>
  `,
})
class HostComponent {}

describe('RovingFocusDirective', (): void => {
  let fixture: ComponentFixture<HostComponent>;
  const press = (key: string): void => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );
  };

  beforeEach((): void => {
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('#a').focus();
  });

  afterEach((): void => fixture.nativeElement.remove());

  it('moves focus with the arrow keys and wraps', (): void => {
    press('ArrowRight');
    expect(document.activeElement?.id).toBe('b');
    press('ArrowRight');
    press('ArrowRight');
    expect(document.activeElement?.id).toBe('a');
    press('ArrowLeft');
    expect(document.activeElement?.id).toBe('c');
  });

  it('jumps with Home and End', (): void => {
    press('End');
    expect(document.activeElement?.id).toBe('c');
    press('Home');
    expect(document.activeElement?.id).toBe('a');
  });

  it('ignores other keys', (): void => {
    press('x');
    expect(document.activeElement?.id).toBe('a');
  });
});
