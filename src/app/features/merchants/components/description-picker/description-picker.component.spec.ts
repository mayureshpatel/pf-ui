import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DescriptionGroup, LookAlikeWarning, TransactionDescription } from '@models/merchant.model';
import { DescriptionPickerComponent } from './description-picker.component';

const row = (
  description: string,
  transactionCount: number,
  merchantId: number | null = null,
  merchantName: string | null = null,
): TransactionDescription => ({ description, transactionCount, merchantId, merchantName });

const group = (
  displayName: string,
  variants: TransactionDescription[],
  similarKeys: string[] = [],
): DescriptionGroup => ({
  key: displayName.toLowerCase(),
  displayName,
  variantCount: variants.length,
  transactionCount: variants.reduce((n, v) => n + v.transactionCount, 0),
  variants,
  similarKeys,
});

const chick = group('CHICK-FIL-A', [row('CHICK-FIL-A #01234', 12), row('CHICK-FIL-A 00871', 1)]);
const catering = group(
  'CFA CATERING',
  [row('CFA CATERING', 3, 9, 'Chick-fil-A Corporate')],
  ['chick-fil-a'],
);
const costco = group('COSTCO', [row('Costco', 5, 4, 'Costco')]);
const groups = [chick, catering, costco];
const rowCount = 4;

const warning: LookAlikeWarning = {
  groupName: 'CFA CATERING',
  words: ['CATERING'],
  descriptions: ['CFA CATERING'],
  merchants: [
    {
      id: 9,
      userId: 1,
      name: 'Chick-fil-A Corporate',
      city: null,
      state: null,
      postalCode: null,
      country: null,
    },
  ],
  nextToGroup: null,
};

describe('DescriptionPickerComponent', () => {
  let fixture: ComponentFixture<DescriptionPickerComponent>;
  let component: DescriptionPickerComponent;

  function render(
    over: Partial<{
      groups: DescriptionGroup[];
      totalRecords: number;
      linking: boolean;
      failed: string[];
      targetId: number | null;
      loading: boolean;
      unlinkedOnly: boolean;
      loadFailed: boolean;
      backToTarget: boolean;
    }> = {},
  ): void {
    fixture.componentRef.setInput('targetName', 'Chick-fil-A');
    fixture.componentRef.setInput('targetId', over.targetId ?? 4);
    fixture.componentRef.setInput('groups', over.groups ?? groups);
    fixture.componentRef.setInput(
      'totalRecords',
      over.totalRecords ?? (over.groups ?? groups).length,
    );
    fixture.componentRef.setInput('loading', over.loading ?? false);
    fixture.componentRef.setInput('linking', over.linking ?? false);
    fixture.componentRef.setInput('failed', over.failed ?? []);
    fixture.componentRef.setInput('initialUnlinkedOnly', over.unlinkedOnly ?? false);
    fixture.componentRef.setInput('loadFailed', over.loadFailed ?? false);
    fixture.componentRef.setInput('backToTarget', over.backToTarget ?? true);
    fixture.detectChanges();
  }
  const all = <T extends HTMLElement>(s: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(s));
  const text = (e: Element | null | undefined): string =>
    (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    all<HTMLButtonElement>('button').find((b) => text(b) === name);
  const checkbox = (description: string): HTMLInputElement =>
    all<HTMLInputElement>('input[type="checkbox"]').find(
      (c) => c.getAttribute('aria-label') === `Select ${description}`,
    ) as HTMLInputElement;
  const tick = (description: string): void => {
    checkbox(description).click();
    fixture.detectChanges();
  };
  const groupBox = (name: string): HTMLInputElement =>
    all<HTMLInputElement>('[data-testid="select-group"]').find(
      (c) => c.getAttribute('aria-label') === `Select group ${name}`,
    ) as HTMLInputElement;
  const tickGroup = (name: string): void => {
    groupBox(name).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DescriptionPickerComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DescriptionPickerComponent);
    component = fixture.componentInstance;
  });

  it('should list the descriptions with how many transactions use them', () => {
    // act
    render();

    // assert & verify
    const items = all('[data-testid="description-row"]').map(text);
    expect(items[0]).toContain('CHICK-FIL-A #01234');
    expect(items[0]).toContain('12 transactions');
    expect(items[1]).toContain('1 transaction');
    expect(items[1]).not.toContain('1 transactions');
  });

  it('should tick rows and emit link with the ticked descriptions', () => {
    // arrange
    const linked: string[][] = [];
    component.link.subscribe((d: string[]) => linked.push(d));
    render();

    // act
    tick('CHICK-FIL-A #01234');
    tick('CHICK-FIL-A 00871');
    button('Link 2 descriptions')?.click();

    // assert & verify
    expect(linked).toEqual([['CHICK-FIL-A #01234', 'CHICK-FIL-A 00871']]);
  });

  it('should show the moving text only for a description linked to another merchant', () => {
    // act
    render();

    // assert & verify
    const items = all('[data-testid="description-row"]').map(text);
    expect(items[2]).toContain('Linked to Chick-fil-A Corporate; linking moves it');
    expect(items[3]).toContain('Already linked to Costco');
    expect(items[0]).not.toContain('Linked to');
  });

  it('should leave every row unticked at the start', () => {
    // act
    render();

    // assert & verify
    expect(all<HTMLInputElement>('input[type="checkbox"]').every((c) => !c.checked)).toBe(true);
  });

  it('should disable Link while nothing is ticked or while linking', () => {
    // act
    render();

    // assert & verify
    expect(button('Link descriptions')?.disabled).toBe(true);

    // act
    tick('CHICK-FIL-A #01234');
    render({ linking: true });

    // assert & verify
    expect(button('Linking…')?.disabled).toBe(true);
  });

  it('should keep ticks across new rows, a search and the toggle', () => {
    // arrange
    render();
    tick('CHICK-FIL-A #01234');

    // act -- the host loads a different page of rows that no longer includes the ticked one
    render({ groups: [group('TARGET', [row('Target', 2)])] });
    render();

    // assert & verify
    expect(checkbox('CHICK-FIL-A #01234').checked).toBe(true);
    expect(button('Link 1 description')).toBeDefined();
  });

  it('should keep failed descriptions ticked and clear the others', () => {
    // arrange
    render();
    tick('CHICK-FIL-A #01234');
    tick('CHICK-FIL-A 00871');

    // act
    render({ failed: ['CHICK-FIL-A 00871'] });

    // assert & verify
    expect(checkbox('CHICK-FIL-A #01234').checked).toBe(false);
    expect(checkbox('CHICK-FIL-A 00871').checked).toBe(true);
  });

  it('should emit searchChange, unlinkedOnlyChange and showMore', () => {
    // arrange
    const events: string[] = [];
    component.searchChange.subscribe((s: string) => events.push(`search:${s}`));
    component.unlinkedOnlyChange.subscribe((v: boolean) => events.push(`unlinked:${v}`));
    component.showMore.subscribe(() => events.push('more'));
    render({ totalRecords: 40 });

    // act
    const input = all<HTMLInputElement>('input[aria-label="Search descriptions"]')[0];
    input.value = 'chick';
    input.dispatchEvent(new Event('input'));
    button('Unlinked only')?.click();
    button('Show more')?.click();

    // assert & verify
    expect(events).toEqual(['search:chick', 'unlinked:true', 'more']);
  });

  it('should reflect the unlinked only toggle as pressed', () => {
    // act
    render({ unlinkedOnly: true });

    // assert & verify
    expect(button('Unlinked only')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('should hide Show more when everything is loaded', () => {
    // act
    render();

    // assert & verify
    expect(button('Show more')).toBeUndefined();
  });

  it('should show both empty states', () => {
    // act
    render({ groups: [], totalRecords: 0 });

    // assert & verify
    expect(text(fixture.nativeElement)).toContain('No descriptions match');

    // act
    render({ groups: [], totalRecords: 0, unlinkedOnly: true });

    // assert & verify
    expect(text(fixture.nativeElement)).toContain('Every description is linked.');
  });

  it('should emit back from Back', () => {
    // arrange
    let wentBack = 0;
    component.back.subscribe(() => wentBack++);
    render();

    // act
    button('Back to Chick-fil-A')?.click();

    // assert & verify
    expect(wentBack).toBe(1);
  });

  // PF-883
  it('should say it is loading, not show a blank area, while the first rows load', () => {
    // act
    render({ groups: [], loading: true });

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="picker-loading"]')).toBeTruthy();
    expect(text(fixture.nativeElement)).toContain('Loading descriptions');
  });

  it('should not show the loading line once rows are there, or the empty message while loading', () => {
    // act
    render({ loading: true });

    // assert & verify -- rows already shown just dim
    expect(fixture.nativeElement.querySelector('[data-testid="picker-loading"]')).toBeNull();

    // act
    render({ groups: [], loading: false });

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="picker-loading"]')).toBeNull();
  });

  // PF-983: groups with Select group, and the look-alike guard
  it('should list each group with its name, its usage and its variants under it', () => {
    // act
    render();

    // assert & verify
    const items = all('[data-testid="picker-group"]');
    expect(items.length).toBe(3);
    expect(text(items[0])).toContain('CHICK-FIL-A');
    expect(text(items[0])).toContain('2 descriptions · 13 transactions');
    expect(items[0].querySelectorAll('[data-testid="description-row"]').length).toBe(2);
    expect(text(items[1])).toContain('Similar names');
    expect(text(items[0])).not.toContain('Similar names');
  });

  it('should tick a whole group, then clear it', () => {
    // arrange
    render();

    // act
    tickGroup('CHICK-FIL-A');

    // assert & verify
    expect(checkbox('CHICK-FIL-A #01234').checked).toBe(true);
    expect(checkbox('CHICK-FIL-A 00871').checked).toBe(true);
    expect(groupBox('CHICK-FIL-A').checked).toBe(true);
    expect(button('Link 2 descriptions')).toBeDefined();

    // act
    tickGroup('CHICK-FIL-A');

    // assert & verify
    expect(component.tickedCount()).toBe(0);
    expect(groupBox('CHICK-FIL-A').checked).toBe(false);
  });

  it('should show a part-ticked group as mixed, and tick the rest from there', () => {
    // arrange
    render();

    // act
    tick('CHICK-FIL-A 00871');

    // assert & verify
    expect(groupBox('CHICK-FIL-A').indeterminate).toBe(true);
    expect(groupBox('CHICK-FIL-A').checked).toBe(false);

    // act
    tickGroup('CHICK-FIL-A');

    // assert & verify
    expect(groupBox('CHICK-FIL-A').indeterminate).toBe(false);
    expect(component.tickedCount()).toBe(2);
  });

  it('should disable Select group when every variant is already linked here', () => {
    // act
    render();

    // assert & verify
    expect(groupBox('COSTCO').disabled).toBe(true);
    expect(groupBox('CHICK-FIL-A').disabled).toBe(false);
  });

  it('should tell how to leave a word out of the search', () => {
    // act
    render();

    // assert & verify
    const input = all<HTMLInputElement>('input[aria-label="Search descriptions"]')[0];
    expect(input.placeholder).toBe('Search, e.g. kroger -fuel');
    const hint = fixture.nativeElement.querySelector(`#${input.getAttribute('aria-describedby')}`);
    expect(text(hint)).toBe('Put a minus before a word to leave it out.');
  });

  it('should hold the ticks still while a link runs', () => {
    // act
    render({ linking: true });

    // assert & verify
    expect(checkbox('CHICK-FIL-A #01234').disabled).toBe(true);
    expect(groupBox('CHICK-FIL-A').disabled).toBe(true);
  });

  describe('with look-alike warnings', () => {
    let events: string[];

    const guarded = (): void => {
      tickGroup('CHICK-FIL-A');
      tick('CFA CATERING');
      button('Link 3 descriptions')?.click();
      fixture.componentRef.setInput('warnings', [warning]);
      fixture.detectChanges();
    };

    beforeEach(() => {
      events = [];
      component.link.subscribe((d: string[]) => events.push(`link:${d.join('|')}`));
      component.linkChecked.subscribe((d: string[]) => events.push(`checked:${d.join('|')}`));
      component.warningsDismissed.subscribe(() => events.push('dismissed'));
      render();
    });

    it('should show the guard in place of the Link button', () => {
      // act
      guarded();

      // assert & verify
      expect(fixture.nativeElement.querySelector('[data-testid="picker-link"]')).toBeNull();
      expect(text(fixture.nativeElement.querySelector('[data-testid="link-guard"]'))).toContain(
        "1 of these contains CATERING, which Chick-fil-A doesn't. Chick-fil-A Corporate exists.",
      );
    });

    it('should untick the warned ones and link the rest on Leave those out', () => {
      // arrange
      guarded();

      // act
      button('Leave those out, link 2')?.click();
      fixture.detectChanges();

      // assert & verify
      expect(events).toEqual([
        'link:CHICK-FIL-A #01234|CHICK-FIL-A 00871|CFA CATERING',
        'checked:CHICK-FIL-A #01234|CHICK-FIL-A 00871',
      ]);
      expect(checkbox('CFA CATERING').checked).toBe(false);
    });

    it('should link every ticked one on Link anyway', () => {
      // arrange
      guarded();

      // act
      button('Link anyway')?.click();

      // assert & verify
      expect(events[1]).toBe('checked:CHICK-FIL-A #01234|CHICK-FIL-A 00871|CFA CATERING');
    });

    it('should dismiss, not link, when leaving out would leave nothing', () => {
      // arrange
      tick('CFA CATERING');
      button('Link 1 description')?.click();
      fixture.componentRef.setInput('warnings', [warning]);
      fixture.detectChanges();

      // act
      button("Don't link these")?.click();

      // assert & verify
      expect(events).toEqual(['link:CFA CATERING', 'dismissed']);
      expect(component.tickedCount()).toBe(0);
    });

    it('should drop the warnings when the ticks change under them', () => {
      // arrange
      guarded();

      // act
      tick('CHICK-FIL-A 00871');

      // assert & verify
      expect(events).toEqual([
        'link:CHICK-FIL-A #01234|CHICK-FIL-A 00871|CFA CATERING',
        'dismissed',
      ]);
    });

    it('should dismiss on Escape inside the guard and put focus back on Link', async () => {
      // arrange
      guarded();

      // act
      fixture.nativeElement
        .querySelector('[data-testid="link-guard"]')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.componentRef.setInput('warnings', []);
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(events[1]).toBe('dismissed');
      expect(document.activeElement).toBe(
        fixture.nativeElement.querySelector('[data-testid="picker-link"]'),
      );
    });
  });

  it('should show how many are shown and how many are still unlinked', () => {
    // arrange
    fixture.componentRef.setInput('unlinkedLeft', 661);

    // act
    render({ totalRecords: 40 });

    // assert & verify
    const progress = fixture.nativeElement.querySelector('[data-testid="picker-progress"]');
    expect(progress.getAttribute('role')).toBe('status');
    expect(text(progress)).toBe('3 of 40 groups shown · 661 not linked yet');
  });

  it('should make the whole row the click target for its checkbox', () => {
    // arrange
    render();

    // act
    all<HTMLElement>('[data-testid="description-row"] label')[0].click();
    fixture.detectChanges();

    // assert & verify
    expect(component.ticked().has('CHICK-FIL-A #01234')).toBe(true);
  });

  it('should say a load failed, with Retry, instead of claiming every description is linked', () => {
    // arrange
    const retry = vi.fn();
    component.retryLoad.subscribe(retry);

    // act
    render({ groups: [], unlinkedOnly: true, loadFailed: true });
    const failed = fixture.nativeElement.querySelector('[data-testid="picker-failed"]');
    fixture.nativeElement.querySelector('[data-testid="picker-retry"]').click();

    // assert & verify
    expect(failed.getAttribute('role')).toBe('alert');
    expect(text(fixture.nativeElement)).not.toContain('Every description is linked');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('should show a failed Show more under the rows it kept', () => {
    // act
    render({ totalRecords: 40, loadFailed: true });

    // assert & verify
    expect(all('[data-testid="description-row"]').length).toBe(rowCount);
    expect(fixture.nativeElement.querySelector('[data-testid="picker-failed"]')).not.toBeNull();
  });

  it('should keep Show more focusable while loading and ignore its clicks', () => {
    // arrange
    const more = vi.fn();
    component.showMore.subscribe(more);
    render({ totalRecords: 40, loading: true });

    // act
    button('Show more')?.click();

    // assert & verify
    expect(button('Show more')?.disabled).toBe(false);
    expect(button('Show more')?.getAttribute('aria-disabled')).toBe('true');
    expect(more).not.toHaveBeenCalled();
  });

  it('should label Back as the overview when no merchant is open', () => {
    // act
    render({ backToTarget: false });

    // assert & verify
    expect(button('Back to overview')).toBeDefined();
    expect(button('Back to Chick-fil-A')).toBeUndefined();
  });
});
