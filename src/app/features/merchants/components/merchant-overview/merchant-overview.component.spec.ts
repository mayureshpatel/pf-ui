import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MerchantOverviewComponent } from './merchant-overview.component';

describe('MerchantOverviewComponent', () => {
  let fixture: ComponentFixture<MerchantOverviewComponent>;
  let component: MerchantOverviewComponent;

  function render(
    merchantCount: number,
    unlinkedCount: number | null,
    hasTransactions = true,
  ): void {
    fixture.componentRef.setInput('merchantCount', merchantCount);
    fixture.componentRef.setInput('unlinkedCount', unlinkedCount);
    fixture.componentRef.setInput('hasTransactions', hasTransactions);
    fixture.detectChanges();
  }
  const text = (): string => (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ').trim();
  const button = (name: string): HTMLButtonElement | undefined =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => (b.textContent ?? '').trim() === name,
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MerchantOverviewComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(MerchantOverviewComponent);
    component = fixture.componentInstance;
  });

  it('should show the merchant and unlinked figures', () => {
    // act
    render(312, 47);

    // assert & verify
    expect(text()).toContain('312 merchants');
    expect(text()).toContain("47 transaction descriptions aren't linked to a merchant.");
    expect(button('Link descriptions')).toBeDefined();
  });

  it('should say every description is linked at zero and hide Link descriptions', () => {
    // act
    render(5, 0);

    // assert & verify
    expect(text()).toContain('Every transaction description is linked.');
    expect(button('Link descriptions')).toBeUndefined();
  });

  it('should show the create-then-link sentence only with no merchants and some transactions', () => {
    // act
    render(0, 12, true);

    // assert & verify
    expect(text()).toContain(
      'Create a merchant, then link the transaction descriptions that belong to it.',
    );

    // act
    render(0, 0, false);

    // assert & verify
    expect(text()).not.toContain('Create a merchant, then link');
  });

  it('should hide Link descriptions with no merchants', () => {
    // act
    render(0, 12, true);

    // assert & verify
    expect(button('Link descriptions')).toBeUndefined();
  });

  it('should show a skeleton while the unlinked figure loads', () => {
    // act
    render(5, null);

    // assert & verify
    expect(fixture.nativeElement.querySelector('[data-testid="unlinked-skeleton"]')).not.toBeNull();
    expect(text()).not.toContain('transaction description');
    expect(button('Link descriptions')).toBeUndefined();
  });

  it('should emit add and linkDescriptions', () => {
    // arrange
    const events: string[] = [];
    component.add.subscribe(() => events.push('add'));
    component.linkDescriptions.subscribe(() => events.push('link'));
    render(5, 3);

    // act
    button('Add merchant')?.click();
    button('Link descriptions')?.click();

    // assert & verify
    expect(events).toEqual(['add', 'link']);
  });
});
