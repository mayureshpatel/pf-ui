import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Merchant } from '@models/merchant.model';
import { NEW_MERCHANT_ID } from '@features/settings/merchant-rules/utils/merchant-options';
import { MerchantPickerComponent } from './merchant-picker.component';

const kroger = { id: 5, name: 'Kroger' } as Merchant;
const shell = { id: 6, name: 'Shell' } as Merchant;

describe('MerchantPickerComponent', () => {
  let fixture: ComponentFixture<MerchantPickerComponent>;
  let component: MerchantPickerComponent;

  const render = (allowCreate = false, error: string | null = null): void => {
    fixture.componentRef.setInput('merchants', [kroger, shell]);
    fixture.componentRef.setInput('allowCreate', allowCreate);
    fixture.componentRef.setInput('error', error);
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MerchantPickerComponent, NoopAnimationsModule] });
    fixture = TestBed.createComponent(MerchantPickerComponent);
    component = fixture.componentInstance;
  });

  it('should be a labelled merchant field', () => {
    // act
    render();

    // assert & verify
    expect(fixture.nativeElement.querySelector('label')?.textContent?.trim()).toBe('Merchant');
  });

  it('should list only the merchants unless creating is allowed', () => {
    // arrange
    render();

    // act
    component.onFilter({ filter: 'Brand New' });

    // assert & verify
    expect(component.options()).toEqual([kroger, shell]);
  });

  it('should add a Create option for a typed name no merchant has, when creating is allowed', () => {
    // arrange
    render(true);

    // act
    component.onFilter({ filter: ' Brand New ' });

    // assert & verify
    const created = component.options().find((m) => m.id === NEW_MERCHANT_ID);
    expect(created?.name).toBe('Brand New');
  });

  it('should not add Create for a name an existing merchant has, ignoring case', () => {
    // arrange
    render(true);

    // act
    component.onFilter({ filter: 'KROGER' });

    // assert & verify
    expect(component.options().some((m) => m.id === NEW_MERCHANT_ID)).toBe(false);
  });

  it('should hold the chosen merchant as its value', () => {
    // arrange
    render();

    // act
    component.value.set(shell);

    // assert & verify
    expect(component.value()).toBe(shell);
  });

  it('should show an error message when given one', () => {
    // act
    render(false, 'Choose a merchant.');

    // assert & verify
    expect(fixture.nativeElement.textContent).toContain('Choose a merchant.');
  });
});
