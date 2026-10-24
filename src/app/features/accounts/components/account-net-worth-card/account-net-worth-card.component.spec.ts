import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AccountNetWorthCardComponent } from './account-net-worth-card.component';

describe('AccountNetWorthCardComponent', () => {
  let fixture: ComponentFixture<AccountNetWorthCardComponent>;
  let component: AccountNetWorthCardComponent;

  function render(assets: number, liabilities: number): void {
    fixture.componentRef.setInput('totals', {
      assets,
      liabilities,
      netWorth: assets - liabilities,
    });
    fixture.detectChanges();
  }
  const q = <T extends HTMLElement>(s: string): T => fixture.nativeElement.querySelector(s) as T;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountNetWorthCardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountNetWorthCardComponent);
    component = fixture.componentInstance;
  });

  it('should show net worth, assets and liabilities in plain words', () => {
    // act
    render(23020.15, 1853.03);

    // assert & verify
    expect(q('[data-testid="net-worth"]').textContent).toContain('$21,167.12');
    expect(q('[data-testid="assets-total"]').textContent).toContain('Assets');
    expect(q('[data-testid="assets-total"]').textContent).toContain('$23,020.15');
    expect(q('[data-testid="liabilities-total"]').textContent).toContain('$1,853.03');
  });

  it("should size the bar by each side's share", () => {
    // act
    render(75, 25);

    // assert & verify
    expect(component.assetsShare()).toBe(75);
    expect(component.liabilitiesShare()).toBe(25);
  });

  it('should show a full emerald bar with no liabilities and an empty bar with nothing', () => {
    // act
    render(100, 0);
    // assert & verify
    expect(component.assetsShare()).toBe(100);
    expect(component.liabilitiesShare()).toBe(0);

    // act
    render(0, 0);
    // assert & verify
    expect(component.assetsShare()).toBe(0);
    expect(component.liabilitiesShare()).toBe(0);
  });

  it('should show a minus sign when net worth is negative', () => {
    // act
    render(100, 500);

    // assert & verify
    expect(q('[data-testid="net-worth"]').textContent?.trim()).toContain('-$400.00');
  });

  it('should describe the bar for assistive technology in words', () => {
    // act
    render(23020.15, 1853.03);

    // assert & verify
    const bar = q('[role="img"]');
    expect(bar.getAttribute('aria-label')).toContain('Assets');
    expect(bar.getAttribute('aria-label')).toContain('$23,020.15');
    expect(bar.getAttribute('aria-label')).toContain('$1,853.03');
  });
});
