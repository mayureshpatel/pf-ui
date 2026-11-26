import { vi, Mocked } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Merchant } from '@models/merchant.model';
import { MerchantApiService } from '../../services/merchant-api.service';
import { byFit, MerchantComboboxComponent } from './merchant-combobox.component';

const merchant = (id: number, name: string, city: string | null = null): Merchant => ({
  id,
  userId: 1,
  name,
  city,
  state: null,
  postalCode: null,
  country: null,
});
const kroger = merchant(1, 'Kroger', 'Dayton');
const fuel = merchant(2, 'Kroger Fuel Center');

describe('MerchantComboboxComponent', () => {
  let fixture: ComponentFixture<MerchantComboboxComponent>;
  let api: Mocked<Pick<MerchantApiService, 'getMerchants'>>;
  let picked: Merchant[];
  let created: string[];
  let escapes: number;

  const field = (): HTMLInputElement => fixture.nativeElement.querySelector('input');
  const options = (): string[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('[role=option]') as NodeListOf<HTMLElement>,
    ).map((o) => (o.textContent ?? '').replace(/\s+/g, ' ').trim());
  const press = (key: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    field().dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };
  const type = (value: string): void => {
    field().value = value;
    field().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      getMerchants: vi.fn().mockReturnValue(
        of({
          content: [merchant(7, 'Circle K'), kroger, merchant(8, 'Kohls')],
          page: { totalElements: 3, totalPages: 1, number: 0, size: 50 },
        }),
      ),
    };
    TestBed.configureTestingModule({
      imports: [MerchantComboboxComponent],
      providers: [{ provide: MerchantApiService, useValue: api }],
    });
    fixture = TestBed.createComponent(MerchantComboboxComponent);
    fixture.componentRef.setInput('comboId', 'm-1');
    fixture.componentRef.setInput('label', 'Merchant for KROGER FUEL CTR');
    fixture.componentRef.setInput('suggestions', [kroger]);
    fixture.componentRef.setInput('createName', 'KROGER FUEL CTR');
    picked = [];
    created = [];
    escapes = 0;
    fixture.componentInstance.pick.subscribe((m: Merchant) => picked.push(m));
    fixture.componentInstance.create.subscribe((n: string) => created.push(n));
    fixture.componentInstance.escape.subscribe(() => escapes++);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('should open on focus with the suggestions first and Create for the row name last', () => {
    // act
    fixture.componentInstance.focus();
    fixture.detectChanges();

    // assert & verify
    expect(field().getAttribute('role')).toBe('combobox');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(options()).toEqual(['Kroger, Dayton', 'Create "KROGER FUEL CTR"']);
    expect(field().getAttribute('aria-activedescendant')).toBe('m-1-option-0');
  });

  it('should link the active merchant on Enter and create on Enter at the Create option', () => {
    // act
    fixture.componentInstance.focus();
    fixture.detectChanges();
    press('Enter');
    fixture.componentInstance.focus();
    fixture.detectChanges();
    press('ArrowDown');
    const enter = press('Enter');

    // assert & verify
    expect(picked).toEqual([kroger]);
    expect(created).toEqual(['KROGER FUEL CTR']);
    expect(enter.defaultPrevented).toBe(true);
    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('should search every merchant as the user types, best fits first, and offer to create the text', () => {
    // act
    type('k');
    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    // assert & verify
    expect(api.getMerchants).toHaveBeenCalledWith('k', { page: 0, size: 50 });
    expect(options()).toEqual(['Kroger, Dayton', 'Kohls', 'Circle K', 'Create "k"']);
  });

  it('should not offer Create when a merchant already has the typed name', () => {
    // arrange
    api.getMerchants.mockReturnValue(
      of({ content: [kroger], page: { totalElements: 1, totalPages: 1, number: 0, size: 50 } }),
    );

    // act
    type('kroger ');
    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    // assert & verify
    expect(options()).toEqual(['Kroger, Dayton']);
  });

  it('should keep the matching suggestions and Create when the search fails', () => {
    // arrange
    api.getMerchants.mockReturnValue(throwError(() => new Error('down')));

    // act
    type('kro');
    vi.advanceTimersByTime(250);
    fixture.detectChanges();

    // assert & verify
    expect(options()).toEqual(['Kroger, Dayton', 'Create "kro"']);
  });

  it('should close and hand focus back on Escape', () => {
    // arrange
    fixture.componentInstance.focus();
    fixture.detectChanges();

    // act
    const event = press('Escape');

    // assert & verify
    expect(escapes).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    expect(options()).toEqual([]);
  });

  it('should offer a merchant created for it, ready for Enter', () => {
    // act
    fixture.componentInstance.offer(fuel);
    fixture.detectChanges();
    press('Enter');

    // assert & verify
    expect(picked).toEqual([fuel]);
  });

  it('should start the search with a character typed on the row', () => {
    // act
    fixture.componentInstance.focus('k');
    fixture.detectChanges();

    // assert & verify
    expect(field().value).toBe('k');
    expect(document.activeElement).toBe(field());
  });

  it('should do nothing while disabled', () => {
    // arrange
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    // act
    fixture.componentInstance.commit(kroger);

    // assert & verify
    expect(field().disabled).toBe(true);
    expect(picked).toEqual([]);
  });

  it('should rank names that start with the text, then a word that does, then the rest', () => {
    // assert & verify
    expect(
      byFit([merchant(1, 'Circle K'), merchant(2, 'Kroger'), merchant(3, 'Sun Kitchen')], 'k').map(
        (m) => m.name,
      ),
    ).toEqual(['Kroger', 'Circle K', 'Sun Kitchen']);
  });
});
