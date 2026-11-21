import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Merchant, MerchantDescriptionLink } from '@models/merchant.model';
import { MerchantEditFormComponent, MerchantFormValue } from './merchant-edit-form.component';

const amazon: Merchant = {
  id: 7,
  userId: 1,
  name: 'Amazon',
  city: 'Seattle',
  state: 'WA',
  postalCode: null,
  country: 'US',
  linkCount: 2,
};
const links: MerchantDescriptionLink[] = [
  { id: 1, merchantId: 7, description: 'AMZN MKTP US*1' },
  { id: 2, merchantId: 7, description: 'AMAZON.COM' },
];

describe('MerchantEditFormComponent', () => {
  let fixture: ComponentFixture<MerchantEditFormComponent>;
  let component: MerchantEditFormComponent;

  function render(merchant: Merchant | null, linked: MerchantDescriptionLink[] = []): void {
    fixture.componentRef.setInput('merchant', merchant);
    fixture.componentRef.setInput('links', linked);
    fixture.detectChanges();
  }
  const el = <T extends HTMLElement>(s: string): T | null => fixture.nativeElement.querySelector(s);
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (e: Element | null | undefined): string =>
    (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find(
      (b) => text(b) === name || b.getAttribute('aria-label') === name,
    );
  function type(selector: string, value: string): void {
    const input = el<HTMLInputElement>(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MerchantEditFormComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MerchantEditFormComponent);
    component = fixture.componentInstance;
  });

  it('should fill the fields from the merchant', () => {
    // act
    render(amazon);

    // assert & verify
    expect(el<HTMLInputElement>('#merchant-name')?.value).toBe('Amazon');
    expect(el<HTMLInputElement>('#merchant-city')?.value).toBe('Seattle');
    expect(el<HTMLInputElement>('#merchant-state')?.value).toBe('WA');
    expect(el<HTMLInputElement>('#merchant-postal-code')?.value).toBe('');
    expect(el<HTMLInputElement>('#merchant-country')?.value).toBe('US');
  });

  it('should require a name and show the message once touched', () => {
    // arrange
    render(null);
    const saved: MerchantFormValue[] = [];
    component.save.subscribe((v: MerchantFormValue) => saved.push(v));

    // act
    type('#merchant-name', '   ');
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(saved).toEqual([]);
    expect(text(el('[data-testid="name-error"]'))).toBe('Name is required.');
  });

  it('should reject a name longer than 255 characters', () => {
    // arrange
    render(null);

    // act
    type('#merchant-name', 'x'.repeat(256));
    component.submit();
    fixture.detectChanges();

    // assert & verify
    expect(text(el('[data-testid="name-error"]'))).toBe('Name must be 255 characters or fewer.');
  });

  it('should emit a value without an id in add mode, trimming blanks to undefined', () => {
    // arrange
    render(null);
    const saved: MerchantFormValue[] = [];
    component.save.subscribe((v: MerchantFormValue) => saved.push(v));

    // act
    type('#merchant-name', '  Costco ');
    type('#merchant-city', ' Issaquah');
    type('#merchant-state', '  ');
    component.submit();

    // assert & verify
    expect(saved).toEqual([
      {
        name: 'Costco',
        city: 'Issaquah',
        state: undefined,
        postalCode: undefined,
        country: undefined,
      },
    ]);
  });

  it('should emit the merchant id in edit mode', () => {
    // arrange
    render(amazon);
    const saved: MerchantFormValue[] = [];
    component.save.subscribe((v: MerchantFormValue) => saved.push(v));

    // act
    type('#merchant-name', 'Amazon Prime');
    component.submit();

    // assert & verify
    expect(saved[0].id).toBe(7);
    expect(saved[0].name).toBe('Amazon Prime');
    expect(saved[0].country).toBe('US');
  });

  it('should not show links, View transactions or Delete in add mode', () => {
    // act
    render(null);

    // assert & verify
    expect(el('[data-testid="linked-descriptions"]')).toBeNull();
    expect(button('View transactions')).toBeUndefined();
    expect(button('Delete merchant')).toBeUndefined();
  });

  it('should list the linked descriptions and emit the right one to remove', () => {
    // arrange
    render(amazon, links);
    const removed: MerchantDescriptionLink[] = [];
    component.removeLink.subscribe((l: MerchantDescriptionLink) => removed.push(l));

    // act
    button('Remove link to AMAZON.COM')?.click();

    // assert & verify
    expect(all('[data-testid="linked-description"]').map(text)).toEqual([
      expect.stringContaining('AMZN MKTP US*1'),
      expect.stringContaining('AMAZON.COM'),
    ]);
    expect(removed.map((l) => l.id)).toEqual([2]);
  });

  it('should say when nothing is linked yet', () => {
    // act
    render(amazon, []);

    // assert & verify
    expect(text(el('[data-testid="linked-descriptions"]'))).toContain(
      'No descriptions linked yet.',
    );
  });

  it('should emit openPicker, viewTransactions and deleteMerchant', () => {
    // arrange
    render(amazon, links);
    const events: string[] = [];
    component.openPicker.subscribe(() => events.push('picker'));
    component.viewTransactions.subscribe(() => events.push('view'));
    component.deleteMerchant.subscribe(() => events.push('delete'));

    // act
    button('Link descriptions')?.click();
    button('View transactions')?.click();
    button('Delete merchant')?.click();

    // assert & verify
    expect(events).toEqual(['picker', 'view', 'delete']);
  });

  it('should refill when a different merchant is shown and be pristine afterwards', () => {
    // arrange
    render(amazon);
    type('#merchant-city', 'Tacoma');
    expect(component.form.dirty).toBe(true);

    // act
    render({ ...amazon, id: 8, name: 'Costco', city: 'Issaquah' });

    // assert & verify
    expect(el<HTMLInputElement>('#merchant-name')?.value).toBe('Costco');
    expect(el<HTMLInputElement>('#merchant-city')?.value).toBe('Issaquah');
    expect(component.form.dirty).toBe(false);
  });

  it('should keep what the user typed when only the links change', () => {
    // arrange
    render(amazon, links);
    type('#merchant-city', 'Tacoma');

    // act
    render(amazon, [links[0]]);

    // assert & verify
    expect(el<HTMLInputElement>('#merchant-city')?.value).toBe('Tacoma');
  });

  // PF-963: the name error is announced and tied to its field, and a failed save lands on it
  it('should announce the name error and link it to the field', () => {
    // arrange
    render(null);

    // act
    component.submit();
    fixture.detectChanges();

    // assert & verify
    const input = el<HTMLInputElement>('#merchant-name') as HTMLInputElement;
    const error = el('[data-testid="name-error"]') as HTMLElement;
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.id).toBe('merchant-name-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('merchant-name-error');
  });

  it('should move focus to the first invalid field when a save is refused', () => {
    // arrange
    render(null);
    document.body.appendChild(fixture.nativeElement);

    // act
    component.submit();

    // assert & verify
    expect(document.activeElement).toBe(el('#merchant-name'));
    fixture.nativeElement.remove();
  });

  it('should fill the name from a search that found nothing', () => {
    // arrange
    fixture.componentRef.setInput('prefillName', 'zzqq');

    // act
    render(null);

    // assert & verify
    expect((el('#merchant-name') as HTMLInputElement).value).toBe('zzqq');
  });

  it('should show a loading line, not "No descriptions linked yet", while links load', () => {
    // arrange
    fixture.componentRef.setInput('linksState', 'loading');

    // act
    render(amazon, []);

    // assert & verify
    expect(el('[data-testid="links-loading"]')?.getAttribute('role')).toBe('status');
    expect(text(fixture.nativeElement)).not.toContain('No descriptions linked yet');
  });

  it('should offer a retry when the links failed to load', () => {
    // arrange
    let retries = 0;
    component.retryLinks.subscribe(() => retries++);
    fixture.componentRef.setInput('linksState', 'failed');
    render(amazon, []);

    // act
    el<HTMLElement>('[data-testid="links-failed"] button')?.click();

    // assert & verify
    expect(text(fixture.nativeElement)).not.toContain('No descriptions linked yet');
    expect(retries).toBe(1);
  });
});
