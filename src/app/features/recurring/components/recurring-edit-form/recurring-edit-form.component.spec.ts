import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Account } from '@models/account.model';
import { Merchant } from '@models/merchant.model';
import { RecurringTransaction } from '@models/recurring.model';
import { RecurringEditFormComponent, RecurringFormValue } from './recurring-edit-form.component';

const accounts = [
  { id: 1, name: 'Checking' },
  { id: 2, name: 'Credit Card' },
] as Account[];
const merchants = [
  { id: 10, name: 'Netflix' },
  { id: 11, name: 'Spotify' },
] as Merchant[];

const netflix: RecurringTransaction = {
  id: 7,
  userId: 1,
  account: accounts[0],
  merchant: merchants[0],
  amount: 10,
  frequency: 'MONTHLY',
  nextDate: '2026-11-03',
  active: true,
};

describe('RecurringEditFormComponent', () => {
  let fixture: ComponentFixture<RecurringEditFormComponent>;
  let component: RecurringEditFormComponent;

  function render(item: RecurringTransaction | null, merchantList: Merchant[] = merchants): void {
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('accounts', accounts);
    fixture.componentRef.setInput('merchants', merchantList);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (e: Element | null | undefined): string =>
    (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find((b) => text(b) === name);
  const fillValid = (): void =>
    component.form.patchValue({
      merchantId: 10,
      accountId: 1,
      amount: 22.99,
      frequency: 'MONTHLY',
      nextDate: new Date(2026, 10, 3),
    });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecurringEditFormComponent, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(RecurringEditFormComponent);
    component = fixture.componentInstance;
  });

  it('should fill every field from the item', () => {
    // act
    render(netflix);

    // assert & verify
    const value = component.form.getRawValue();
    expect(value.merchantId).toBe(10);
    expect(value.accountId).toBe(1);
    expect(value.amount).toBe(10);
    expect(value.frequency).toBe('MONTHLY');
    expect(value.nextDate).toEqual(new Date(2026, 10, 3));
  });

  it('should start an empty add form as monthly and invalid', () => {
    // act
    render(null);

    // assert & verify
    expect(component.form.controls.frequency.value).toBe('MONTHLY');
    expect(component.form.valid).toBe(false);
  });

  it('should require merchant, account, amount, frequency and date and emit nothing while invalid', () => {
    // arrange
    render(null);
    const saved: RecurringFormValue[] = [];
    component.save.subscribe((v: RecurringFormValue) => saved.push(v));
    component.form.controls.frequency.setValue(null);

    // act
    component.submit();

    // assert & verify
    expect(saved).toEqual([]);
    for (const control of Object.values(component.form.controls)) {
      expect(control.touched).toBe(true);
    }
    expect(component.form.controls.merchantId.errors?.['required']).toBe(true);
    expect(component.form.controls.accountId.errors?.['required']).toBe(true);
    expect(component.form.controls.amount.errors?.['required']).toBe(true);
    expect(component.form.controls.frequency.errors?.['required']).toBe(true);
    expect(component.form.controls.nextDate.errors?.['required']).toBe(true);
  });

  it('should reject zero and negative amounts', () => {
    // arrange
    render(null);
    fillValid();

    // act & assert & verify
    component.form.controls.amount.setValue(0);
    expect(component.form.controls.amount.valid).toBe(false);
    component.form.controls.amount.setValue(-5);
    expect(component.form.controls.amount.valid).toBe(false);
    component.form.controls.amount.setValue(0.01);
    expect(component.form.controls.amount.valid).toBe(true);
  });

  it('should emit the value without an id in add mode and with the id in edit mode', () => {
    // arrange
    const saved: RecurringFormValue[] = [];
    component.save.subscribe((v: RecurringFormValue) => saved.push(v));
    render(null);
    fillValid();

    // act
    component.submit();
    render(netflix);
    component.submit();

    // assert & verify
    expect(saved[0]).toEqual({
      merchantId: 10,
      accountId: 1,
      amount: 22.99,
      frequency: 'MONTHLY',
      nextDate: '2026-11-03',
      active: true,
    });
    expect(saved[1].id).toBe(7);
    expect(saved[1].amount).toBe(10);
  });

  it('should submit the next date from local getters, not a UTC-shifted string', () => {
    // arrange
    render(null);
    fillValid();
    const lateEvening = new Date(2026, 10, 3, 23, 30);
    component.form.controls.nextDate.setValue(lateEvening);
    const saved: RecurringFormValue[] = [];
    component.save.subscribe((v: RecurringFormValue) => saved.push(v));

    // act
    component.submit();

    // assert & verify
    expect(saved[0].nextDate).toBe('2026-11-03');
  });

  it('should keep the paused state of the item when saving', () => {
    // arrange
    render({ ...netflix, active: false });
    const saved: RecurringFormValue[] = [];
    component.save.subscribe((v: RecurringFormValue) => saved.push(v));

    // act
    component.submit();

    // assert & verify
    expect(saved[0].active).toBe(false);
  });

  it('should show the last charge line', () => {
    // act
    render({ ...netflix, lastChargeDate: '2026-10-03', lastChargeAmount: 12 });

    // assert & verify
    expect(text(fixture.nativeElement.querySelector('[data-testid="last-charge"]'))).toBe(
      'Last charged Oct 3, $12.00',
    );
  });

  it('should show the price-change note and emit updatePrice', () => {
    // arrange
    let updated = 0;
    component.updatePrice.subscribe(() => updated++);
    render({ ...netflix, priceChange: { previousAmount: 10, newAmount: 12, since: '2026-09-03' } });

    // act
    button('Update price')?.click();

    // assert & verify
    expect(text(fixture.nativeElement.querySelector('[data-testid="price-change"]'))).toBe(
      'Was $10.00, now $12.00 since Sep 3',
    );
    expect(updated).toBe(1);
  });

  it('should offer Pause for an active item and Resume for a paused one', () => {
    // arrange
    let toggled = 0;
    component.togglePaused.subscribe(() => toggled++);

    // act
    render(netflix);

    // assert & verify
    expect(button('Pause')).toBeDefined();
    expect(button('Resume')).toBeUndefined();
    button('Pause')?.click();
    expect(toggled).toBe(1);

    // act
    render({ ...netflix, active: false });

    // assert & verify
    expect(button('Resume')).toBeDefined();
  });

  it('should emit deleteItem and hide the item actions in add mode', () => {
    // arrange
    let deleted = 0;
    component.deleteItem.subscribe(() => deleted++);
    render(netflix);

    // act
    button('Delete')?.click();

    // assert & verify
    expect(deleted).toBe(1);

    // act
    render(null);

    // assert & verify
    expect(button('Delete')).toBeUndefined();
    expect(button('Pause')).toBeUndefined();
  });

  it('should refill when a different item is shown and keep typing when only the lists change', () => {
    // arrange
    render(netflix);
    component.form.controls.amount.setValue(11);
    component.form.controls.amount.markAsDirty();

    // act -- only the merchant list changes
    render(netflix, [merchants[0]]);

    // assert & verify
    expect(component.form.controls.amount.value).toBe(11);

    // act -- a different item
    render({ ...netflix, id: 8, amount: 40 });

    // assert & verify
    expect(component.form.controls.amount.value).toBe(40);
    expect(component.form.dirty).toBe(false);
  });

  it('should show the saved values again when the same item reloads and the form is untouched', () => {
    // arrange
    render(netflix);

    // act -- Update price saved 12 and the list reloaded the same item
    render({ ...netflix, amount: 12, priceChange: null });

    // assert & verify
    expect(component.form.controls.amount.value).toBe(12);
    expect(component.form.dirty).toBe(false);
  });

  it('should keep what the user typed when the same item reloads under unsaved edits', () => {
    // arrange
    render(netflix);
    component.form.controls.amount.setValue(11);
    component.form.controls.amount.markAsDirty();

    // act
    render({ ...netflix, amount: 12 });

    // assert & verify
    expect(component.form.controls.amount.value).toBe(11);
  });

  it('should include the item merchant in the choices even when the search no longer lists it', () => {
    // act
    render(netflix, [merchants[1]]);

    // assert & verify
    expect(component.merchantChoices().map((m) => m.id)).toEqual([11, 10]);
  });

  it('should emit what is typed into the merchant search', () => {
    // arrange
    const filters: string[] = [];
    component.merchantFilter.subscribe((term: string) => filters.push(term));
    render(netflix);

    // act
    component.onMerchantFilter('spo');

    // assert & verify
    expect(filters).toEqual(['spo']);
  });
});
