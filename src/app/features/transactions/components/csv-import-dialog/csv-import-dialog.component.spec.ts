import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CsvImportDialogComponent } from './csv-import-dialog.component';
import { TransactionImportService } from '@features/transactions/services/transaction-import.service';
import { ToastService } from '@core/services/toast.service';
import { Account, AccountType } from '@models/account.model';
import { BankName } from '@models/transaction.model';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('CsvImportDialogComponent', () => {
  let component: CsvImportDialogComponent;
  let fixture: ComponentFixture<CsvImportDialogComponent>;
  
  // Mock services using Vitest
  const mockImportService = {
    uploadCsv: vi.fn(),
    saveTransactions: vi.fn(),
    calculateFileHash: vi.fn()
  };
  
  const mockToastService = {
    success: vi.fn(),
    error: vi.fn()
  };

  const mockAccounts: Account[] = [
    {
      id: 1,
      name: 'Discover Card',
      type: AccountType.CREDIT_CARD,
      currentBalance: 0,
      bankName: BankName.DISCOVER
    },
    {
      id: 2,
      name: 'Checking',
      type: AccountType.CHECKING,
      currentBalance: 1000,
      bankName: BankName.CAPITAL_ONE
    },
    {
      id: 3,
      name: 'Savings',
      type: AccountType.SAVINGS,
      currentBalance: 5000,
      bankName: BankName.CAPITAL_ONE // Duplicate format
    },
    {
      id: 4,
      name: 'Cash',
      type: AccountType.CASH,
      currentBalance: 200
      // No bank format
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [CsvImportDialogComponent],
      providers: [
        { provide: TransactionImportService, useValue: mockImportService },
        { provide: ToastService, useValue: mockToastService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CsvImportDialogComponent);
    component = fixture.componentInstance;
    
    // Set inputs
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('accounts', mockAccounts);
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeDefined();
  });

  describe('Automatic Detection', () => {
    it('should auto-select Bank and Account when Unique Match found (Discover)', () => {
      // Given a file named "Discover-2024.csv"
      const file = new File([''], 'Discover-2024.csv', { type: 'text/csv' });
      const event = { files: [file] };

      // When
      component.onFilesSelect(event);

      // Then
      const items = component.importItems();
      expect(items.length).toBe(1);
      expect(items[0].bankName).toBe(BankName.DISCOVER); // Detected from filename
      expect(items[0].accountId).toBe(1); // Detected because Account ID 1 is the ONLY Discover account
    });

    it('should auto-select Bank but NOT Account when Multiple Matches found (Capital One)', () => {
      // Given a file named "Capital One Dec.csv"
      const file = new File([''], 'Capital One Dec.csv', { type: 'text/csv' });
      const event = { files: [file] };

      // When
      component.onFilesSelect(event);

      // Then
      const items = component.importItems();
      expect(items.length).toBe(1);
      expect(items[0].bankName).toBe(BankName.CAPITAL_ONE); // Detected
      expect(items[0].accountId).toBeNull(); // Should be NULL because we have 2 Capital One accounts (ID 2 and 3)
    });

    it('should detect Bank but not Account if Account has no configuration', () => {
      // Given a file named "Synovus.csv" (We have no Synovus account in mock)
      const file = new File([''], 'Synovus.csv', { type: 'text/csv' });
      const event = { files: [file] };

      // When
      component.onFilesSelect(event);

      // Then
      const items = component.importItems();
      expect(items[0].bankName).toBe(BankName.SYNOVUS);
      expect(items[0].accountId).toBeNull();
    });
  });

  describe('Manual Selection', () => {
    it('should auto-fill Bank Format when Account is selected manually', () => {
      // Given an item with no bank format
      const file = new File([''], 'Unknown.csv', { type: 'text/csv' });
      component.importItems.set([{
        id: '1',
        file: file,
        accountId: null,
        bankName: null,
        previews: [],
        status: 'pending'
      }]);

      // When user selects Account ID 1 (Discover)
      component.onAccountChange(0, 1);

      // Then
      const items = component.importItems();
      expect(items[0].accountId).toBe(1);
      expect(items[0].bankName).toBe(BankName.DISCOVER); // Auto-filled from account settings
    });
  });
});