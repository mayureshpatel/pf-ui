import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LookAlikeWarning } from '@models/merchant.model';
import { LinkGuardComponent } from './link-guard.component';

const fuel: LookAlikeWarning = {
  groupName: 'KROGER FUEL CTR',
  words: ['FUEL', 'CTR'],
  descriptions: ['KROGER FUEL CTR #1', 'KROGER FUEL CTR #2'],
  merchants: [
    {
      id: 5,
      userId: 1,
      name: 'Kroger Fuel Center',
      city: null,
      state: null,
      postalCode: null,
      country: null,
    },
  ],
  nextToGroup: 'KROGER',
};
const selected = ['KROGER #431', 'KROGER FUEL CTR #1', 'KROGER #12', 'KROGER FUEL CTR #2'];

describe('LinkGuardComponent', () => {
  let fixture: ComponentFixture<LinkGuardComponent>;
  let events: string[];

  const el = (testId: string): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  const render = async (descriptions: string[] = selected): Promise<void> => {
    fixture.componentRef.setInput('targetName', 'Kroger');
    fixture.componentRef.setInput('warnings', [fuel]);
    fixture.componentRef.setInput('descriptions', descriptions);
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LinkGuardComponent] }).compileComponents();
    fixture = TestBed.createComponent(LinkGuardComponent);
    events = [];
    const c = fixture.componentInstance;
    c.leaveOut.subscribe((d: string[]) => events.push(`leave:${d.join('|')}`));
    c.linkAnyway.subscribe((d: string[]) => events.push(`anyway:${d.join('|')}`));
    c.dismiss.subscribe(() => events.push('dismiss'));
  });

  it('should explain each warning in a labelled group and focus the first choice', async () => {
    // act
    await render();

    // assert & verify
    const box = el('link-guard');
    expect(box.getAttribute('role')).toBe('group');
    expect(
      fixture.nativeElement.querySelector(`#${box.getAttribute('aria-labelledby')}`).textContent,
    ).toContain('Check before linking to Kroger');
    expect(el('link-guard-warning').textContent?.trim()).toBe(
      "2 of these contain FUEL and CTR, which Kroger doesn't. Kroger Fuel Center exists.",
    );
    expect(document.activeElement).toBe(el('link-guard-leave-out'));
  });

  it('should hand back what is left on Leave those out', async () => {
    // arrange
    await render();

    // act
    el('link-guard-leave-out').click();

    // assert & verify
    expect(el('link-guard-leave-out').textContent?.trim()).toBe('Leave those out, link 2');
    expect(events).toEqual(['leave:KROGER #431|KROGER #12']);
  });

  it("should say Don't link these when every one is warned", async () => {
    // arrange
    await render(fuel.descriptions);

    // act
    el('link-guard-leave-out').click();

    // assert & verify
    expect(el('link-guard-leave-out').textContent?.trim()).toBe("Don't link these");
    expect(events).toEqual(['leave:']);
  });

  it('should hand back every one on Link anyway, and dismiss on Escape', async () => {
    // arrange
    await render();

    // act
    el('link-guard-anyway').click();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    el('link-guard').dispatchEvent(escape);

    // assert & verify
    expect(events).toEqual([`anyway:${selected.join('|')}`, 'dismiss']);
    expect(escape.defaultPrevented).toBe(true);
  });
});
