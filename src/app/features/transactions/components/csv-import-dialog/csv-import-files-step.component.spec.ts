import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TransactionImportService } from '@features/transactions/services/transaction-import.service';
import { Account, BankName } from '@models/account.model';
import { CsvImportBatchStore } from './csv-import-batch.store';
import { CsvImportFilesStepComponent } from './csv-import-files-step.component';

function account(id: number, bank: BankName): Account {
  return { id, bank, name: `Account ${id}` } as Account;
}

function file(name: string): File {
  return new File(['Date,Description,Amount\n'], name);
}

describe('CsvImportFilesStepComponent', () => {
  let fixture: ComponentFixture<CsvImportFilesStepComponent>;
  let store: CsvImportBatchStore;

  const text = (): string => fixture.nativeElement.textContent.replace(/\s+/g, ' ');
  const all = <T extends HTMLElement>(selector: string): T[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));
  const rows = (): HTMLElement[] => all('[data-testid="file-row"]');
  const rowFor = (name: string): HTMLElement =>
    rows().find((r: HTMLElement): boolean => r.textContent?.includes(name) ?? false)!;
  const checkboxOf = (row: HTMLElement): HTMLInputElement =>
    row.querySelector<HTMLInputElement>('[data-testid="row-select"] input')!;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function addFiles(...names: string[]): Promise<void> {
    store.addFiles(names.map(file));
    await settle();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsvImportFilesStepComponent],
      providers: [
        CsvImportBatchStore,
        {
          provide: TransactionImportService,
          useValue: {
            uploadCsv: () => new Subject<unknown[]>(),
            calculateFileHash: async (f: File): Promise<string> => `hash-${f.name}`,
            checkAlreadyImported: () => of([]),
          },
        },
      ],
    }).compileComponents();
    store = TestBed.inject(CsvImportBatchStore);
    store.setAccounts([
      account(1, BankName.CAPITAL_ONE),
      account(2, BankName.DISCOVER),
      account(3, BankName.SYNOVUS),
      account(4, BankName.SYNOVUS),
    ]);
    fixture = TestBed.createComponent(CsvImportFilesStepComponent);
    await settle();
  });

  it('should show an empty state and no table before any file is added', () => {
    expect(all('[data-testid="empty-state"]').length).toBe(1);
    expect(rows().length).toBe(0);
    expect(text()).not.toContain('Add files');
  });

  it('should list added files with size and statement month and offer Add files', async () => {
    await addFiles('capone-2026-01.csv');

    expect(all('[data-testid="empty-state"]').length).toBe(0);
    const row = rowFor('capone-2026-01.csv');
    expect(row.textContent).toContain('2026-01');
    expect(row.textContent).toMatch(/\d+(\.\d)? (B|KB)/);
    expect(text()).toContain('Add files');
  });

  it('should flag a file that matches several accounts as needing an account, with the reason', async () => {
    await addFiles('synovus-2026-02.csv');

    const row = rowFor('synovus-2026-02.csv');
    expect(row.querySelector('[data-testid="needs-account"]')).not.toBeNull();
    expect(row.textContent).toContain('Needs an account');
    expect(row.textContent).toContain('more than one account');
  });

  it('should say when no account matches and when the name is not recognised', async () => {
    store.setAccounts([account(1, BankName.CAPITAL_ONE)]);
    await addFiles('discover-2026-02.csv', 'statement.csv');

    expect(rowFor('discover-2026-02.csv').textContent).toContain('no account for this bank');
    expect(rowFor('statement.csv').textContent).toContain('name not recognised');
  });

  it('should not flag a file that was matched to an account', async () => {
    await addFiles('capone-2026-01.csv');

    expect(rowFor('capone-2026-01.csv').querySelector('[data-testid="needs-account"]')).toBeNull();
  });

  it('should summarise 3 files including the one that needs an account', async () => {
    await addFiles('capone-2026-01.csv', 'discover-2026-03.csv', 'synovus-2026-07.csv');

    expect(
      fixture.nativeElement.querySelector('[data-testid="summary"]').textContent.trim(),
    ).toContain('3 files, 2026-01 to 2026-07, 1 needs an account');
  });

  it('should list months missing from the range', async () => {
    await addFiles('capone-2026-01.csv', 'capone-2026-04.csv');

    expect(text()).toContain('missing 2026-02, 2026-03');
  });

  it('should update the summary when a file is removed', async () => {
    await addFiles('capone-2026-01.csv', 'discover-2026-03.csv', 'synovus-2026-07.csv');

    rowFor('synovus-2026-07.csv')
      .querySelector<HTMLButtonElement>('[data-testid="remove-file"]')!
      .click();
    await settle();

    expect(rows().length).toBe(2);
    const summary = fixture.nativeElement.querySelector('[data-testid="summary"]').textContent;
    expect(summary).toContain('2 files, 2026-01 to 2026-03');
    expect(summary).not.toContain('needs an account');
  });

  it('should label the remove button with the file name', async () => {
    await addFiles('capone-2026-01.csv');

    const button = rowFor('capone-2026-01.csv').querySelector('[data-testid="remove-file"]')!;
    expect(button.getAttribute('aria-label')).toBe('Remove capone-2026-01.csv');
  });

  it('should give every select and checkbox its own accessible name across rows', async () => {
    await addFiles('capone-2026-01.csv', 'discover-2026-02.csv');

    const ids: string[] = [];
    for (const select of all('p-select')) {
      const labelId =
        select.getAttribute('ariaLabelledBy') ?? select.getAttribute('aria-labelledby');
      const inner = select.querySelector('[aria-labelledby]')?.getAttribute('aria-labelledby');
      const id = inner ?? labelId;
      expect(id).toBeTruthy();
      expect(fixture.nativeElement.querySelector(`#${id}`)?.textContent?.trim()).toBeTruthy();
      ids.push(id!);
    }
    expect(ids.length).toBe(6);
    expect(new Set(ids).size).toBe(ids.filter((id) => !id.includes('bulk')).length + 2);

    const names = all<HTMLInputElement>('p-checkbox input').map((i) =>
      i.getAttribute('aria-label'),
    );
    expect(names).toEqual([
      'Select all files',
      'Select capone-2026-01.csv',
      'Select discover-2026-02.csv',
    ]);
  });

  it('should disable Apply until a row is selected', async () => {
    await addFiles('capone-2026-01.csv');

    const apply = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-testid="apply-selected"] button');
    expect(apply().disabled).toBe(true);

    checkboxOf(rowFor('capone-2026-01.csv')).click();
    await settle();

    expect(apply().disabled).toBe(false);
  });

  it('should apply account and bank to the selected rows only', async () => {
    await addFiles('synovus-2026-01.csv', 'synovus-2026-02.csv', 'synovus-2026-03.csv');

    checkboxOf(rowFor('synovus-2026-01.csv')).click();
    checkboxOf(rowFor('synovus-2026-03.csv')).click();
    await settle();
    fixture.componentInstance.bulkAccountId.set(4);
    fixture.componentInstance.bulkBank.set(BankName.UNIVERSAL);
    await settle();
    fixture.nativeElement.querySelector('[data-testid="apply-selected"] button').click();
    await settle();

    const byName = (n: string) => store.items().find((i) => i.file.name === n)!;
    expect(byName('synovus-2026-01.csv').accountId).toBe(4);
    expect(byName('synovus-2026-01.csv').bankName).toBe(BankName.UNIVERSAL);
    expect(byName('synovus-2026-03.csv').accountId).toBe(4);
    expect(byName('synovus-2026-02.csv').accountId).toBeNull();
    expect(text()).toContain('1 needs an account');
  });

  it('should leave a field unchanged when its apply value is empty', async () => {
    await addFiles('capone-2026-01.csv');

    checkboxOf(rowFor('capone-2026-01.csv')).click();
    await settle();
    fixture.componentInstance.bulkAccountId.set(2);
    await settle();
    fixture.nativeElement.querySelector('[data-testid="apply-selected"] button').click();
    await settle();

    const item = store.items()[0];
    expect(item.accountId).toBe(2);
    expect(item.bankName).toBe(BankName.CAPITAL_ONE);
  });

  // The select overlay needs matchMedia, which jsdom lacks; this runs under --browsers=ChromiumHeadless.
  it.skipIf(/jsdom/i.test(navigator.userAgent))(
    'should leave the account unchanged after the apply account is cleared in the select',
    async () => {
      await addFiles('capone-2026-01.csv');
      checkboxOf(rowFor('capone-2026-01.csv')).click();
      const bulkSelect: HTMLElement = fixture.nativeElement.querySelector(
        'p-select[inputId="csv-bulk-account"]',
      );
      bulkSelect.querySelector<HTMLElement>('.p-select-label, [role="combobox"]')!.click();
      await settle();
      const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
        (o) => o.textContent?.includes('Account 2'),
      )!;
      option.click();
      await settle();
      expect(fixture.componentInstance.bulkAccountId()).toBe(2);

      bulkSelect
        .querySelector('.p-select-clear-icon')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      fixture.nativeElement.querySelector('[data-testid="apply-selected"] button').click();
      await settle();

      expect(fixture.componentInstance.bulkAccountId()).toBeNull();
      expect(store.items()[0].accountId).toBe(1);
    },
  );

  it.skipIf(/jsdom/i.test(navigator.userAgent))(
    'should keep every file control inside a 375px viewport',
    async () => {
      const { page } = await import('vitest/browser');
      await page.viewport(375, 812);
      document.body.appendChild(fixture.nativeElement);
      await addFiles('capone-2026-01.csv');

      const row = rowFor('capone-2026-01.csv');
      const controls = [
        ...Array.from(row.querySelectorAll<HTMLElement>('p-select')),
        row.querySelector<HTMLElement>('[data-testid="remove-file"]')!,
      ];
      expect(controls.length).toBe(3);
      for (const el of controls) {
        const box = el.getBoundingClientRect();
        expect(box.width).toBeGreaterThan(0);
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(375);
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
      await page.viewport(1280, 800);
    },
  );

  it('should select and clear every row with select-all', async () => {
    await addFiles('capone-2026-01.csv', 'discover-2026-02.csv');
    const selectAll = (): HTMLInputElement =>
      fixture.nativeElement.querySelector('[data-testid="select-all"] input');

    selectAll().click();
    await settle();
    expect(rows().every((r: HTMLElement): boolean => checkboxOf(r).checked)).toBe(true);

    selectAll().click();
    await settle();
    expect(rows().some((r: HTMLElement): boolean => checkboxOf(r).checked)).toBe(false);
  });

  it('should drop a removed file from the selection', async () => {
    await addFiles('capone-2026-01.csv', 'discover-2026-02.csv');
    checkboxOf(rowFor('capone-2026-01.csv')).click();
    await settle();

    rowFor('capone-2026-01.csv')
      .querySelector<HTMLButtonElement>('[data-testid="remove-file"]')!
      .click();
    await settle();

    const apply: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="apply-selected"] button',
    );
    expect(apply.disabled).toBe(true);
  });

  it('should mark spreadsheet files as unsupported', async () => {
    await addFiles('capone-2026-01.xlsx', 'discover-2026-02.xls', 'capone-2026-03.csv');

    expect(rowFor('capone-2026-01.xlsx').textContent).toContain('unsupported - export as CSV');
    expect(rowFor('discover-2026-02.xls').textContent).toContain('unsupported - export as CSV');
    expect(rowFor('capone-2026-03.csv').textContent).not.toContain('unsupported');
  });

  it('should add files chosen through the file picker', async () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [file('capone-2026-05.csv')] });
    input.dispatchEvent(new Event('change'));
    await settle();

    expect(rows().length).toBe(1);
    expect(store.items()[0].file.name).toBe('capone-2026-05.csv');
  });

  it('should disable the controls while a preview is running', async () => {
    await addFiles('capone-2026-01.csv');
    void store.previewAll();
    await vi.waitFor(() => expect(store.previewing()).toBe(true));
    await settle();

    const row = rowFor('capone-2026-01.csv');
    expect(row.querySelector<HTMLButtonElement>('[data-testid="remove-file"]')!.disabled).toBe(
      true,
    );
    expect(checkboxOf(row).disabled).toBe(true);
    expect(row.querySelectorAll('p-select.p-disabled').length).toBe(2);
    expect(fixture.nativeElement.querySelector('input[type="file"]').disabled).toBe(true);
  });
});
