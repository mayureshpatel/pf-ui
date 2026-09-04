import {ComponentFixture, TestBed} from "@angular/core/testing";
import {CsvImportDialog} from "./csv-import-dialog.component";
import {TransactionImportService} from "@features/transactions/services/transaction-import.service";
import {ToastService} from "@core/services/toast.service";
import {BankName} from "@models/account.model";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {FileSelectEvent} from "primeng/fileupload";
import {of} from "rxjs";

describe("CsvImportDialog", () => {
  let component: CsvImportDialog;
  let fixture: ComponentFixture<CsvImportDialog>;

  // Mock services using Vitest
  const mockImportService = {
    uploadCsv: vi.fn(),
    saveTransactions: vi.fn(),
    saveBulkTransactions: vi.fn(),
    calculateFileHash: vi.fn()
  };

  const mockToastService = {
    success: vi.fn(),
    error: vi.fn()
  };

  const mockAccounts = [
    {
      id: 1,
      name: "Discover Card",
      type: {code: "CREDIT_CARD"},
      currentBalance: 0,
      bank: BankName.DISCOVER,
      user: {id: 1},
      currency: {code: "USD"},
      version: 1
    } as any,
    {
      id: 2,
      name: "Checking",
      type: {code: "CHECKING"},
      currentBalance: 1000,
      bank: BankName.CAPITAL_ONE,
      user: {id: 1},
      currency: {code: "USD"},
      version: 1
    } as any,
    {
      id: 3,
      name: "Savings",
      type: {code: "SAVINGS"},
      currentBalance: 5000,
      bank: BankName.CAPITAL_ONE,
      user: {id: 1},
      currency: {code: "USD"},
      version: 1
    } as any,
    {
      id: 4,
      name: "Cash",
      type: {code: "CASH"},
      currentBalance: 200,
      bank: BankName.STANDARD,
      user: {id: 1},
      currency: {code: "USD"},
      version: 1
    } as any
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [CsvImportDialog],
      providers: [
        {provide: TransactionImportService, useValue: mockImportService},
        {provide: ToastService, useValue: mockToastService}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CsvImportDialog);
    component = fixture.componentInstance;

    // Set inputs
    fixture.componentRef.setInput("visible", true);
    fixture.componentRef.setInput("accounts", mockAccounts);

    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeDefined();
  });

  describe("Automatic Detection", () => {
    it("should auto-select Bank and Account when Unique Match found (Discover)", () => {
      // Given a file named "Discover-2024.csv"
      const file = new File([""], "Discover-2024.csv", {type: "text/csv"});
      const event = {files: [file]} as FileSelectEvent;

      // When
      component.onFilesSelect(event);

      // Then
      const items = component.importItems();
      expect(items.length).toBe(1);
      expect(items[0].bankName).toBe(BankName.DISCOVER); // Detected from filename
      expect(items[0].accountId).toBe(1); // Detected because Account ID 1 is the ONLY Discover account
    });

    it("should auto-select Bank but NOT Account when Multiple Matches found (Capital One)", () => {
      // Given a file named "Capital One Dec.csv"
      const file = new File([""], "Capital One Dec.csv", {type: "text/csv"});
      const event = {files: [file]} as FileSelectEvent;

      // When
      component.onFilesSelect(event);

      // Then
      const items = component.importItems();
      expect(items.length).toBe(1);
      expect(items[0].bankName).toBe(BankName.CAPITAL_ONE); // Detected
      expect(items[0].accountId).toBe(2);
    });

    it("should detect Bank but not Account if Account has no configuration", () => {
      // Given a file named "Synovus.csv" (We have no Synovus account in mock)
      const file = new File([""], "Synovus.csv", {type: "text/csv"});
      const event = {files: [file]} as FileSelectEvent;

      // When
      component.onFilesSelect(event);

      // Then
      const items = component.importItems();
      expect(items[0].bankName).toBe(BankName.SYNOVUS);
      expect(items[0].accountId).toBe(-1);
    });
  });

  describe("Manual Selection", () => {
    it("should auto-fill Bank Format when Account is selected manually", () => {
      // Given an item with no bank format
      const file = new File([""], "Unknown.csv", {type: "text/csv"});
      component.importItems.set([
        {
          id: "1",
          file: file,
          accountId: 0 as any,
          bankName: null,
          previews: [],
          status: "pending"
        }
      ]);

      // When user selects Account ID 1 (Discover)
      component.onAccountChange(0, 1);

      // Then
      const items = component.importItems();
      expect(items[0].accountId).toBe(1);
      expect(items[0].bankName).toBe(BankName.DISCOVER); // Auto-filled from account settings
    });
  });

  describe("Upload and Save Actions", () => {
    it("should upload files and transition to step 1", async () => {
      const file = new File(["content"], "test.csv", {type: "text/csv"});
      component.importItems.set([
        {
          id: "1",
          file: file,
          accountId: 1,
          bankName: BankName.DISCOVER,
          previews: [],
          status: "pending"
        }
      ]);

      mockImportService.uploadCsv.mockReturnValue(of([{amount: 100}]));

      component.uploadAndPreview();

      expect(mockImportService.uploadCsv).toHaveBeenCalledWith(1, file, BankName.DISCOVER);

      // wait for the observable to resolve
      await new Promise(r => setTimeout(r, 0));
      expect(component.currentStep()).toBe(1);
      expect(component.importItems()[0].status).toBe("ready");
    });

    it("should save batch and close dialog on success", async () => {
      component.importItems.set([
        {
          id: "1",
          file: new File([""], "test.csv"),
          accountId: 1,
          bankName: BankName.DISCOVER,
          previews: [{amount: 100} as any],
          status: "ready"
        }
      ]);

      mockImportService.calculateFileHash.mockResolvedValue("hash123");
      mockImportService.saveBulkTransactions.mockReturnValue(of("Success"));

      const emitSpy = vi.spyOn(component.importComplete, "emit");
      const hideSpy = vi.spyOn(component, "onHide");

      component.saveTransactions();

      // Wait for async calculateFileHash to resolve
      await new Promise(r => setTimeout(r, 0));
      expect(mockImportService.saveBulkTransactions).toHaveBeenCalled();
      expect(mockToastService.success).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalled();
      expect(hideSpy).toHaveBeenCalled();
    });
  });
});
