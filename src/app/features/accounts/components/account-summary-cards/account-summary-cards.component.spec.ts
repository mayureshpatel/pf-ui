import {ComponentFixture, TestBed} from '@angular/core/testing';
import {AccountSummaryCardsComponent} from './account-summary-cards.component';
import {Account} from '@models/account.model';

describe('AccountSummaryCardsComponent', () => {
  let component: AccountSummaryCardsComponent;
  let fixture: ComponentFixture<AccountSummaryCardsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AccountSummaryCardsComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSummaryCardsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('accounts', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should calculate summary correctly with mixed accounts', () => {
    const mockAccounts = [
      { currentBalance: 1000, type: { isAsset: true } },
      { currentBalance: -200, type: { isAsset: true } }, // Edge case: asset with negative balance
      { currentBalance: 500, type: { isAsset: false } }, // Liability
      { currentBalance: -100, type: { isAsset: false } }  // Liability with negative balance
    ] as Account[];

    fixture.componentRef.setInput('accounts', mockAccounts);
    fixture.detectChanges();

    const summary = component.summary();
    
    // totalAssets: 1000 + -200 = 800
    // totalLiabilities: abs(500) + abs(-100) = 500 + 100 = 600
    // netWorth: 800 - 600 = 200
    expect(summary.totalAssets).toBe(800);
    expect(summary.totalLiabilities).toBe(600);
    expect(summary.netWorth).toBe(200);
  });

  it('should calculate summary correctly with no accounts', () => {
    fixture.componentRef.setInput('accounts', []);
    fixture.detectChanges();

    const summary = component.summary();
    expect(summary.totalAssets).toBe(0);
    expect(summary.totalLiabilities).toBe(0);
    expect(summary.netWorth).toBe(0);
  });
});
