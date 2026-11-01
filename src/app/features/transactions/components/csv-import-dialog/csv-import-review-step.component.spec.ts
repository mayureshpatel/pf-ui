import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CategoryApiService } from '@features/categories/services/category-api.service';
import { MerchantApiService } from '@features/merchants/services/merchant-api.service';
import { TransactionImportService } from '@features/transactions/services/transaction-import.service';
import { Account, BankName } from '@models/account.model';
import { Category, CategoryType } from '@models/category.model';
import { Merchant } from '@models/merchant.model';
import { TransactionPreview, TransactionType } from '@models/transaction.model';
import {
  BatchFile,
  CsvImportBatchStore,
  ReviewRow,
  ReviewRowOrigin,
} from './csv-import-batch.store';
import { CsvImportReviewStepComponent } from './csv-import-review-step.component';

const inBrowser = !/jsdom/i.test(navigator.userAgent);

function category(id: number, name: string, parent: Category | null = null): Category {
  return { id, userId: 1, name, type: CategoryType.EXPENSE, parent, icon: '', color: '' };
}

function merchant(id: number, name: string): Merchant {
  return { id, userId: 1, name, city: null, state: null, postalCode: null, country: null };
}

const FOOD = category(100, 'Food');
const HEALTH = category(101, 'Health');
const RETAIL = category(102, 'Retail');
const GROCERIES = category(1, 'Groceries', FOOD);
const SHOPPING = category(2, 'Shopping', RETAIL);
const PHARMACY = category(3, 'Pharmacy', HEALTH);
/** Selectable options in an open select; group headers are rendered as options too. */
const OPTION = '[role="option"]:not(.p-select-option-group)';
const WALGREENS = merchant(10, 'Walgreens');
const KROGER = merchant(11, 'Kroger');

function preview(
  description: string,
  overrides: Partial<TransactionPreview> = {},
): TransactionPreview {
  return {
    date: '2026-01-05',
    postDate: '2026-01-06',
    description,
    amount: -12.5,
    type: TransactionType.EXPENSE,
    suggestedCategory: null,
    suggestedMerchant: null,
    duplicate: false,
    ...overrides,
  };
}

function account(id: number, bank: BankName): Account {
  return { id, bank, name: `Account ${id}` } as Account;
}

interface Setup {
  previews: Record<string, TransactionPreview[]>;
  alreadyImported?: string[];
  failing?: Record<string, string>;
}

describe('CsvImportReviewStepComponent', () => {
  let fixture: ComponentFixture<CsvImportReviewStepComponent>;
  let store: CsvImportBatchStore;

  const all = <T extends HTMLElement>(
    selector: string,
    root: ParentNode = fixture.nativeElement,
  ): T[] => Array.from(root.querySelectorAll<T>(selector));
  const text = (el: Element): string => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rows = (): HTMLElement[] => all('[data-testid="review-row"]');
  const headers = (): HTMLElement[] => all('[data-testid="file-header"]');
  const headerFor = (name: string): HTMLElement =>
    headers().find((h: HTMLElement): boolean => text(h).includes(name))!;
  const rowsFor = (description: string): HTMLElement[] =>
    rows().filter(
      (r: HTMLElement): boolean =>
        text(r.querySelector('[data-testid="row-description"]')!) === description,
    );
  const statusOf = (row: HTMLElement): HTMLElement =>
    row.querySelector<HTMLElement>('[data-testid="row-status"]')!;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function configure(providers: unknown[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CsvImportReviewStepComponent],
      providers: [
        {
          provide: CategoryApiService,
          useValue: {
            getCategories: () => of([FOOD, HEALTH, RETAIL, GROCERIES, SHOPPING, PHARMACY]),
          },
        },
        {
          provide: MerchantApiService,
          useValue: {
            getMerchants: vi.fn(() =>
              of({
                content: [WALGREENS, KROGER],
                page: { totalElements: 2, totalPages: 1, number: 0, size: 2000 },
              }),
            ),
          },
        },
        ...(providers as never[]),
      ],
    }).compileComponents();
  }

  /** A real store, previewed through its public API. */
  async function setup({ previews, alreadyImported = [], failing = {} }: Setup): Promise<void> {
    await configure([
      CsvImportBatchStore,
      {
        provide: TransactionImportService,
        useValue: {
          calculateFileHash: async (f: File): Promise<string> => `hash-${f.name}`,
          checkAlreadyImported: (pairs: { accountId: number; fileHash: string }[]) =>
            of(pairs.filter((p) => alreadyImported.some((n) => p.fileHash === `hash-${n}`))),
          uploadCsv: (_id: number, f: File) =>
            failing[f.name]
              ? throwError(
                  () => new HttpErrorResponse({ status: 400, error: { detail: failing[f.name] } }),
                )
              : of(previews[f.name] ?? []),
        },
      },
    ]);
    store = TestBed.inject(CsvImportBatchStore);
    store.setAccounts([account(1, BankName.CAPITAL_ONE), account(2, BankName.DISCOVER)]);
    const names = [...Object.keys(previews), ...Object.keys(failing)];
    store.addFiles(names.map((n: string): File => new File(['x'], n)));
    // files the name matcher could not place (e.g. .xls) still need an account to be previewed
    store
      .items()
      .filter((f: BatchFile): boolean => f.accountId === null || f.bankName === null)
      .forEach((f: BatchFile): void => {
        store.setAccount(f.id, 1);
        store.setBank(f.id, BankName.CAPITAL_ONE);
      });
    await store.previewAll();
    fixture = TestBed.createComponent(CsvImportReviewStepComponent);
    await settle();
  }

  /** A store double whose rows carry any origin, including `'guess'` (the real store has none yet). */
  async function setupWithOrigins(origins: ReviewRowOrigin[]): Promise<void> {
    const reviewRows: ReviewRow[] = origins.map(
      (origin: ReviewRowOrigin, i: number): ReviewRow => ({
        preview: preview(`ROW ${origin.toUpperCase()} ${i}`),
        merchant: null,
        category: origin === 'none' ? null : GROCERIES,
        origin,
        skip: null,
      }),
    );
    reviewRows.push({
      preview: preview('ROW SKIPPED NONE', { duplicate: true }),
      merchant: null,
      category: null,
      origin: 'none',
      skip: 'duplicate',
    });
    const file: BatchFile = {
      id: 'f1',
      file: new File(['x'], 'capone-2026-01.csv'),
      accountId: 1,
      bankName: BankName.CAPITAL_ONE,
      statementMonth: '2026-01',
      matchReason: 'matched',
      hash: 'h',
      alreadyImported: false,
      status: 'ready',
      error: null,
      rows: reviewRows,
      discardedEdits: false,
      failedAt: null,
      skipReason: null,
      result: null,
    };
    await configure([
      {
        provide: CsvImportBatchStore,
        useValue: {
          items: signal([file]),
          accountList: signal([account(1, BankName.CAPITAL_ONE)]),
          committing: signal(false),
          editRow: vi.fn(),
        },
      },
    ]);
    fixture = TestBed.createComponent(CsvImportReviewStepComponent);
    await settle();
  }

  afterEach(async () => {
    document.documentElement.style.fontSize = '';
    if (inBrowser) {
      const { page } = await import('vitest/browser');
      await page.viewport(1280, 800);
    }
  });

  it('should group rows under one header per file with that file’s counts', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [
          preview('KROGER #1'),
          preview('KROGER #2'),
          preview('OLD ONE', { duplicate: true }),
        ],
        'discover-2026-02.csv': [preview('SHELL OIL'), preview('AMAZON')],
      },
    });

    expect(headers().length).toBe(2);
    const capone = text(headerFor('capone-2026-01.csv'));
    expect(capone).toContain('Account 1');
    expect(capone).toContain('2026-01');
    expect(capone).toContain('3 rows, 2 will import, 1 skipped');
    expect(text(headerFor('discover-2026-02.csv'))).toContain('2 rows, 2 will import, 0 skipped');
    expect(rows().length).toBe(5);

    // rows follow their own file's header
    const order = all('[data-testid="file-header"], [data-testid="review-row"]').map(text);
    expect(order[0]).toContain('capone-2026-01.csv');
    expect(order[1]).toContain('KROGER #1');
    expect(order[4]).toContain('discover-2026-02.csv');
    expect(order[5]).toContain('SHELL OIL');
  });

  it('should show date, raw description, amount with sign, merchant and category', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [
          preview('WALGREENS #123 ATLANTA', {
            amount: -42.1,
            suggestedMerchant: WALGREENS,
            suggestedCategory: PHARMACY,
          }),
          preview('PAYROLL ACME', { amount: 2000, type: TransactionType.INCOME }),
        ],
      },
    });

    const [expense, income] = rows();
    expect(text(expense)).toContain('Jan 5, 2026');
    expect(text(expense)).toContain('WALGREENS #123 ATLANTA');
    expect(text(expense)).toContain('-$42.10');
    expect(text(expense)).toContain('Walgreens');
    expect(text(expense)).toContain('Pharmacy');
    const incomeAmount = income.querySelector<HTMLElement>('[data-testid="row-amount"]')!;
    expect(text(incomeAmount)).toBe('+$2,000.00');
    expect(incomeAmount.className).toContain('text-emerald-700');
    expect(incomeAmount.className).toContain('dark:text-emerald-400');
    expect(expense.querySelector('[data-testid="row-amount"]')!.className).toContain(
      'text-rose-700',
    );
  });

  it('should grey out duplicate rows and label them as skipped with the reason', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [preview('NEW ONE'), preview('OLD ONE', { duplicate: true })],
      },
    });

    const [kept, dup] = [rowsFor('NEW ONE')[0], rowsFor('OLD ONE')[0]];
    expect(text(statusOf(dup))).toContain('Will be skipped');
    expect(text(statusOf(dup))).toContain('duplicate');
    expect(statusOf(dup).querySelector('i.pi')).not.toBeNull();
    expect(dup.getAttribute('data-skipped')).toBe('true');
    expect(dup.className).toContain('opacity-60');
    expect(text(statusOf(kept))).not.toContain('skipped');
    expect(all('p-select.p-disabled', dup).length).toBe(2);
    expect(all('p-select.p-disabled', kept).length).toBe(0);
  });

  it('should show every row of an already-imported file as skipped', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [preview('A'), preview('B')],
        'discover-2026-02.csv': [preview('C')],
      },
      alreadyImported: ['capone-2026-01.csv'],
    });

    const header = text(headerFor('capone-2026-01.csv'));
    expect(header).toContain('Already imported');
    expect(header).toContain('2 rows, 0 will import, 2 skipped');
    for (const description of ['A', 'B']) {
      const [row] = rowsFor(description);
      expect(text(statusOf(row))).toBe('Will be skipped: file already imported');
      expect(row.getAttribute('data-skipped')).toBe('true');
    }
    expect(text(statusOf(rowsFor('C')[0]))).not.toContain('skipped');
  });

  it('should list files that failed to preview with their reason, above the other files’ rows', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [preview('KROGER')],
        'capone-2026-02.xls': [],
      },
      failing: { 'discover-2026-03.csv': 'Unexpected header row' },
    });

    const alert = fixture.nativeElement.querySelector(
      '[data-testid="failed-files"]',
    ) as HTMLElement;
    expect(alert).not.toBeNull();
    expect(text(alert)).toContain('2 files could not be read');
    expect(text(alert)).toContain('capone-2026-02.xls');
    expect(text(alert)).toContain('Excel files (.xls, .xlsx) are not supported');
    expect(text(alert)).toContain('discover-2026-03.csv');
    expect(text(alert)).toContain('Could not read this file');
    // the alert comes before the table, and the readable file still shows
    const table = fixture.nativeElement.querySelector('[data-testid="review-table"]');
    expect(alert.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(headers().length).toBe(1);
    expect(rowsFor('KROGER').length).toBe(1);
  });

  it('should say when a file has no transactions', async () => {
    await setup({
      previews: { 'capone-2026-01.csv': [], 'discover-2026-02.csv': [preview('SHELL')] },
    });

    expect(text(headerFor('capone-2026-01.csv'))).toContain('0 rows');
    expect(all('[data-testid="empty-file"]').map(text)).toEqual(['No transactions in this file']);
  });

  it('should show a total count of transactions, rows to import and rows to skip', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [preview('A'), preview('B', { duplicate: true })],
        'discover-2026-02.csv': [preview('C', { suggestedCategory: GROCERIES })],
      },
    });

    const summary = text(fixture.nativeElement.querySelector('[data-testid="review-summary"]'));
    expect(summary).toContain('3 transactions in 2 files');
    expect(summary).toContain('2 will import');
    expect(summary).toContain('1 will be skipped');
  });

  it('should label rule, guess, edited and uncategorized rows distinctly, in text and icon', async () => {
    await setupWithOrigins(['rule', 'guess', 'edited', 'none']);

    const labels = ['RULE', 'GUESS', 'EDITED', 'NONE'].map((o, i) =>
      statusOf(rowsFor(`ROW ${o} ${i}`)[0]),
    );
    expect(labels.map(text)).toEqual(['Rule applied', 'Suggested', 'Edited', 'Uncategorized']);
    const icons = labels.map((l) => l.querySelector('i.pi')!.className);
    expect(new Set(icons).size).toBe(4);
  });

  it('should show only uncategorized and guessed rows with Needs a look', async () => {
    await setupWithOrigins(['rule', 'guess', 'edited', 'none', 'none']);
    const toggle = (): HTMLButtonElement =>
      fixture.nativeElement.querySelector('[data-testid="needs-look-toggle"]');

    expect(text(toggle())).toContain('Needs a look (3)');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    expect(rows().length).toBe(6);

    toggle().click();
    await settle();

    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(rows().map((r) => text(r.querySelector('[data-testid="row-description"]')!))).toEqual([
      'ROW GUESS 1',
      'ROW NONE 3',
      'ROW NONE 4',
    ]);
    expect(headers().length).toBe(1);

    toggle().click();
    await settle();
    expect(rows().length).toBe(6);
  });

  it('should say when nothing needs a look', async () => {
    await setupWithOrigins(['rule', 'edited']);

    fixture.nativeElement.querySelector('[data-testid="needs-look-toggle"]').click();
    await settle();

    expect(rows().length).toBe(0);
    expect(text(fixture.nativeElement)).toContain(
      'Every row has a category from a rule or from you',
    );
    // only the message: no empty table frame or column headings
    expect(fixture.nativeElement.querySelector('[data-testid="review-table"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="column-headers"]')).toBeNull();
  });

  it('should load categories and merchants once for every row’s options', async () => {
    await setup({
      previews: { 'capone-2026-01.csv': [preview('A'), preview('B'), preview('C')] },
    });

    const merchants = TestBed.inject(MerchantApiService).getMerchants as ReturnType<typeof vi.fn>;
    expect(merchants).toHaveBeenCalledTimes(1);
    const options = fixture.componentInstance.merchantOptions().map((o) => o.label);
    expect(options).toEqual(['Kroger', 'Walgreens']);
    expect(
      fixture.componentInstance.categoryGroups().map((g) => [g.label, g.items.map((o) => o.label)]),
    ).toEqual([
      ['Food', ['Food / Groceries']],
      ['Health', ['Health / Pharmacy']],
      ['Retail', ['Retail / Shopping']],
    ]);
  });

  it.skipIf(!inBrowser)(
    'should group categories under their parent, offering only subcategories',
    async () => {
      await setup({ previews: { 'capone-2026-01.csv': [preview('KROGER #1')] } });

      rowsFor('KROGER #1')[0]
        .querySelector<HTMLElement>('[data-testid="row-category"] [role="combobox"]')!
        .click();
      await settle();

      await vi.waitFor(() =>
        expect(
          Array.from(document.querySelectorAll('.p-select-option-group')).map((o) => text(o)),
        ).toEqual(['Food', 'Health', 'Retail']),
      );
      expect(Array.from(document.querySelectorAll(OPTION)).map((o) => text(o))).toEqual([
        'Groceries',
        'Pharmacy',
        'Shopping',
      ]);
      // a parent header cannot be picked
      (document.querySelector('.p-select-option-group') as HTMLElement).click();
      await settle();
      expect(store.items()[0].rows[0].category).toBeNull();
    },
  );

  it('should still show a top-level category that is already on a row', async () => {
    await setup({
      previews: { 'capone-2026-01.csv': [preview('KROGER #1', { suggestedCategory: FOOD })] },
    });

    const shown = rowsFor('KROGER #1')[0].querySelector(
      '[data-testid="row-category"] .p-select-label',
    );
    expect(text(shown!)).toBe('Food');
  });

  it('should give every editor its own accessible name and keep ids unique', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [preview('KROGER #1'), preview('KROGER #1')],
        'discover-2026-02.csv': [preview('KROGER #1')],
      },
    });

    const comboboxes = all('[data-testid="review-row"] [role="combobox"]');
    expect(comboboxes.length).toBe(6);
    const labelIds = comboboxes.map((c) => c.getAttribute('aria-labelledby'));
    expect(new Set(labelIds).size).toBe(6);
    for (const id of labelIds) {
      expect(id).toBeTruthy();
      const label = document.getElementById(id!);
      expect(label).not.toBeNull();
      expect(text(label!)).toMatch(/^(Merchant|Category) for KROGER #1, Jan 5, 2026$/);
    }
    // p-select also writes its shown value to aria-label; aria-labelledby wins in the
    // accessible-name computation, so the row-specific label is what is announced
    for (const c of comboboxes) expect(c.tabIndex).toBe(0);
    const ids = all('[id]').map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.skipIf(!inBrowser)(
    'should change only the edited row’s category, by keyboard, leaving a same-description row as it was',
    async () => {
      await setup({
        previews: {
          'capone-2026-01.csv': [
            preview('WALGREENS #123', {
              suggestedCategory: PHARMACY,
              suggestedMerchant: WALGREENS,
            }),
            preview('WALGREENS #123', {
              suggestedCategory: PHARMACY,
              suggestedMerchant: WALGREENS,
            }),
          ],
        },
      });
      const { userEvent } = await import('vitest/browser');

      const [first] = rowsFor('WALGREENS #123');
      const categorySelect = first.querySelector<HTMLElement>(
        '[data-testid="row-category"] [role="combobox"]',
      )!;
      categorySelect.focus();
      await userEvent.keyboard('{Enter}');
      await settle();
      // the overlay opens with focus in its filter box
      await vi.waitFor(() =>
        expect(document.activeElement?.classList.contains('p-select-filter')).toBe(true),
      );
      await userEvent.keyboard('Shop');
      await vi.waitFor(() =>
        expect(Array.from(document.querySelectorAll(OPTION)).map((o) => text(o))).toEqual([
          'Shopping',
        ]),
      );
      await userEvent.keyboard('{ArrowDown}');
      await vi.waitFor(() =>
        expect(document.querySelector('[role="option"].p-focus')?.textContent?.trim()).toBe(
          'Shopping',
        ),
      );
      await userEvent.keyboard('{Enter}');
      await settle();

      const [edited, untouched] = store.items()[0].rows;
      expect(edited.category?.id).toBe(SHOPPING.id);
      expect(edited.origin).toBe('edited');
      expect(edited.merchant?.id).toBe(WALGREENS.id);
      expect(untouched.category?.id).toBe(PHARMACY.id);
      expect(untouched.origin).toBe('rule');
      const [firstRow, secondRow] = rowsFor('WALGREENS #123');
      expect(text(statusOf(firstRow))).toBe('Edited');
      expect(text(firstRow)).toContain('Shopping');
      expect(text(statusOf(secondRow))).toBe('Rule applied');
      expect(text(secondRow)).toContain('Pharmacy');
      expect(document.querySelector('p-dialog, [role="dialog"]')).toBeNull();
    },
  );

  it.skipIf(!inBrowser)(
    'should change only the edited row’s merchant when a merchant is picked',
    async () => {
      await setup({
        previews: { 'capone-2026-01.csv': [preview('KROGER #1'), preview('KROGER #1')] },
      });

      const [first] = rowsFor('KROGER #1');
      first.querySelector<HTMLElement>('[data-testid="row-merchant"] [role="combobox"]')!.click();
      await settle();
      const option = await vi.waitFor((): HTMLElement => {
        const found = Array.from(document.querySelectorAll<HTMLElement>(OPTION)).find(
          (o) => text(o) === 'Kroger',
        );
        if (!found) throw new Error('Kroger option not rendered yet');
        return found;
      });
      option.click();
      await settle();

      const [edited, untouched] = store.items()[0].rows;
      expect(edited.merchant?.id).toBe(KROGER.id);
      expect(edited.origin).toBe('edited');
      expect(untouched.merchant).toBeNull();
      expect(untouched.origin).toBe('none');
    },
  );

  it.skipIf(!inBrowser)(
    'should render only a window of a 3000-row batch and reach the last row by scrolling',
    async () => {
      const many = (prefix: string, n: number): TransactionPreview[] =>
        Array.from({ length: n }, (_, i) => preview(`${prefix} ${i}`, { amount: -(i + 1) }));
      await setup({
        previews: {
          'capone-2026-01.csv': many('CAP', 1500),
          'discover-2026-01.csv': many('DIS', 1500),
        },
      });

      expect(text(fixture.nativeElement.querySelector('[data-testid="review-summary"]'))).toContain(
        '3000 transactions in 2 files',
      );
      const rendered = rows().length;
      expect(rendered).toBeGreaterThan(0);
      expect(rendered).toBeLessThan(60);

      const scroller = fixture.nativeElement.querySelector(
        '[data-testid="review-scroller"]',
      ) as HTMLElement;
      scroller.scrollTop = scroller.scrollHeight;
      scroller.dispatchEvent(new Event('scroll'));
      await settle();

      expect(rows().length).toBeLessThan(60);
      expect(rowsFor('DIS 1499').length).toBe(1);
      expect(rowsFor('CAP 0').length).toBe(0);
    },
  );

  /** Scrolls the list to its end and checks the last row shows fully, with no overlapping rows. */
  async function expectLastRowReachable(lastDescription: string): Promise<void> {
    const scroller = fixture.nativeElement.querySelector(
      '[data-testid="review-scroller"]',
    ) as HTMLElement;
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll'));
    await settle();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await settle();

    expect(rows().length).toBeLessThan(60);
    const [last] = rowsFor(lastDescription);
    expect(last).toBeDefined();
    const view = scroller.getBoundingClientRect();
    const box = last.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(view.top - 1);
    expect(box.bottom).toBeLessThanOrEqual(view.bottom + 1);
    // the rendered items sit edge to edge: no overlap and no gap
    const boxes = all('[data-testid="file-header"], [data-testid="review-row"]').map((el) =>
      el.getBoundingClientRect(),
    );
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].top - boxes[i - 1].bottom)).toBeLessThan(1);
    }
    // the contents of the last card fit inside it
    for (const select of all<HTMLElement>('p-select', last)) {
      expect(select.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom);
    }
  }

  const manyPreviews = (prefix: string, n: number): TransactionPreview[] =>
    Array.from({ length: n }, (_, i) => preview(`${prefix} ${i}`, { amount: -(i + 1) }));

  it.skipIf(!inBrowser)(
    'should keep the window aligned with a larger browser font size',
    async () => {
      document.documentElement.style.fontSize = '20px';
      await setup({
        previews: {
          'capone-2026-01.csv': manyPreviews('CAP', 1500),
          'discover-2026-01.csv': manyPreviews('DIS', 1500),
        },
      });

      await expectLastRowReachable('DIS 1499');
    },
  );

  it.skipIf(!inBrowser)(
    'should window a 3000-row batch at phone width and reach the last card',
    async () => {
      const { page } = await import('vitest/browser');
      await page.viewport(375, 812);
      await setup({
        previews: {
          'capone-2026-01.csv': manyPreviews('CAP', 1500),
          'discover-2026-01.csv': manyPreviews('DIS', 1500),
        },
      });
      expect(rows().length).toBeGreaterThan(0);
      expect(rows().length).toBeLessThan(30);

      await expectLastRowReachable('DIS 1499');
    },
  );

  it.skipIf(!inBrowser)(
    'should stack each row as a card inside a 375px viewport with no horizontal scroll',
    async () => {
      const { page } = await import('vitest/browser');
      await page.viewport(375, 812);
      await setup({
        previews: {
          'capone-2026-01.csv': [
            preview('A VERY LONG BANK DESCRIPTION THAT GOES ON AND ON FOR A WHILE #12345', {
              suggestedMerchant: WALGREENS,
              suggestedCategory: PHARMACY,
            }),
            preview('SHORT'),
          ],
        },
      });
      await settle();

      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
      for (const row of rows()) {
        const card = row.getBoundingClientRect();
        expect(card.left).toBeGreaterThanOrEqual(0);
        expect(card.right).toBeLessThanOrEqual(375);
        const selects = all<HTMLElement>('p-select', row);
        expect(selects.length).toBe(2);
        const [merchantBox, categoryBox] = selects.map((s) => s.getBoundingClientRect());
        // stacked: category sits below merchant, both full card width-ish
        expect(categoryBox.top).toBeGreaterThanOrEqual(merchantBox.bottom);
        for (const box of [merchantBox, categoryBox]) {
          expect(box.width).toBeGreaterThan(200);
          expect(box.left).toBeGreaterThanOrEqual(card.left);
          expect(box.right).toBeLessThanOrEqual(card.right);
          expect(box.bottom).toBeLessThanOrEqual(card.bottom);
        }
        const status = statusOf(row).getBoundingClientRect();
        expect(status.bottom).toBeLessThanOrEqual(card.bottom);
      }
      // the desktop column headings are not shown on a phone
      const columns = fixture.nativeElement.querySelector('[data-testid="column-headers"]');
      expect(columns.getBoundingClientRect().height).toBe(0);
    },
  );

  it.skipIf(!inBrowser)('should lay rows out as one line per transaction on desktop', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [preview('KROGER', { suggestedCategory: GROCERIES })],
      },
    });

    const row = rows()[0];
    const [merchantBox, categoryBox] = all<HTMLElement>('p-select', row).map((s) =>
      s.getBoundingClientRect(),
    );
    expect(Math.abs(merchantBox.top - categoryBox.top)).toBeLessThan(2);
    expect(categoryBox.left).toBeGreaterThan(merchantBox.right);
    const columns = fixture.nativeElement.querySelector('[data-testid="column-headers"]');
    expect(columns.getBoundingClientRect().height).toBeGreaterThan(0);
  });
  const toggleNeedsLook = async (): Promise<void> => {
    fixture.nativeElement.querySelector('[data-testid="needs-look-toggle"]').click();
    await settle();
  };
  const toggleText = (): string =>
    text(fixture.nativeElement.querySelector('[data-testid="needs-look-toggle"]'));

  async function pickOption(row: HTMLElement, field: 'merchant' | 'category', label: string) {
    row.querySelector<HTMLElement>(`[data-testid="row-${field}"] [role="combobox"]`)!.click();
    await settle();
    const option = await vi.waitFor((): HTMLElement => {
      const found = Array.from(document.querySelectorAll<HTMLElement>(OPTION)).find(
        (o) => text(o) === label,
      );
      if (!found) throw new Error(`${label} option not rendered yet`);
      return found;
    });
    option.click();
    await settle();
  }

  it.skipIf(!inBrowser)(
    'should keep a row that only had its merchant set in Needs a look while it has no category',
    async () => {
      await setup({
        previews: {
          'capone-2026-01.csv': [
            preview('KROGER #1'),
            preview('KROGER #2'),
            preview('RULED', { suggestedCategory: GROCERIES }),
          ],
        },
      });

      await pickOption(rowsFor('KROGER #1')[0], 'merchant', 'Kroger');

      expect(store.items()[0].rows[0].origin).toBe('edited');
      expect(store.items()[0].rows[0].category).toBeNull();
      expect(text(statusOf(rowsFor('KROGER #1')[0]))).toBe('Edited - Uncategorized');
      expect(toggleText()).toContain('Needs a look (2)');
      await toggleNeedsLook();
      expect(rows().map((r) => text(r.querySelector('[data-testid="row-description"]')!))).toEqual([
        'KROGER #1',
        'KROGER #2',
      ]);
    },
  );

  it.skipIf(!inBrowser)(
    'should show a row whose category was cleared as uncategorized and needing a look',
    async () => {
      await setup({
        previews: {
          'capone-2026-01.csv': [
            preview('WALGREENS #1', { suggestedCategory: PHARMACY }),
            preview('WALGREENS #1', { suggestedCategory: PHARMACY }),
          ],
        },
      });
      expect(toggleText()).toContain('Needs a look (0)');

      rowsFor('WALGREENS #1')[0]
        .querySelector('[data-testid="row-category"] .p-select-clear-icon')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      const [cleared, untouched] = store.items()[0].rows;
      expect(cleared.category).toBeNull();
      expect(untouched.category?.id).toBe(PHARMACY.id);
      const [first, second] = rowsFor('WALGREENS #1');
      expect(text(statusOf(first))).toBe('Edited - Uncategorized');
      expect(statusOf(first).querySelector('i.pi-exclamation-triangle')).not.toBeNull();
      expect(text(statusOf(second))).toBe('Rule applied');
      expect(toggleText()).toContain('Needs a look (1)');
      await toggleNeedsLook();
      expect(rows().length).toBe(1);
    },
  );

  it.skipIf(!inBrowser)(
    'should keep a row fixed under Needs a look listed, with focus in it, until the filter is toggled',
    async () => {
      await setup({
        previews: {
          'capone-2026-01.csv': [
            preview('KROGER #1'),
            preview('KROGER #2'),
            preview('RULED', { suggestedCategory: GROCERIES }),
          ],
        },
      });
      await toggleNeedsLook();
      expect(rows().length).toBe(2);
      const { userEvent } = await import('vitest/browser');

      const row = rowsFor('KROGER #1')[0];
      row.querySelector<HTMLElement>('[data-testid="row-category"] [role="combobox"]')!.focus();
      await userEvent.keyboard('{Enter}');
      await vi.waitFor(() =>
        expect(document.activeElement?.classList.contains('p-select-filter')).toBe(true),
      );
      await userEvent.keyboard('Groc');
      await vi.waitFor(() =>
        expect(Array.from(document.querySelectorAll(OPTION)).map((o) => text(o))).toEqual([
          'Groceries',
        ]),
      );
      await userEvent.keyboard('{ArrowDown}');
      await vi.waitFor(() =>
        expect(document.querySelector('[role="option"].p-focus')).not.toBeNull(),
      );
      await userEvent.keyboard('{Enter}');
      await settle();

      expect(store.items()[0].rows[0].category?.id).toBe(GROCERIES.id);
      const [stillListed] = rowsFor('KROGER #1');
      expect(stillListed).toBe(row);
      expect(text(statusOf(stillListed))).toBe('Edited');
      expect(stillListed.contains(document.activeElement)).toBe(true);
      expect(rowsFor('KROGER #2').length).toBe(1);
      expect(toggleText()).toContain('Needs a look (1)');

      await toggleNeedsLook();
      await toggleNeedsLook();
      expect(rowsFor('KROGER #1').length).toBe(0);
      expect(rowsFor('KROGER #2').length).toBe(1);
    },
  );

  it('should show a dash for a missing or invalid date and still render every row', async () => {
    const bad: [string, unknown][] = [
      ['EMPTY DATE', ''],
      ['NULL DATE', null],
      ['UNDEFINED DATE', undefined],
      ['GARBAGE DATE', 'garbage'],
      ['MONTH ONLY', '2026-01'],
      ['IMPOSSIBLE DATE', '2026-02-31'],
    ];
    await setup({
      previews: {
        'capone-2026-01.csv': [
          ...bad.map(([description, date]) => preview(description, { date: date as string })),
          preview('GOOD DATE', { date: '2026-01-05T00:00:00Z' }),
        ],
      },
    });

    expect(rows().length).toBe(bad.length + 1);
    for (const [description] of bad) {
      const [row] = rowsFor(description);
      const date = row.querySelector('[data-testid="row-date"]')!;
      expect(text(date.querySelector('[aria-hidden="true"]')!)).toBe('–');
      expect(text(date.querySelector('.sr-only')!)).toBe('Date unknown');
      const labelId = row
        .querySelector('[data-testid="row-category"] [role="combobox"]')!
        .getAttribute('aria-labelledby')!;
      expect(text(document.getElementById(labelId)!)).toBe(
        `Category for ${description}, date unknown`,
      );
    }
    expect(text(rowsFor('GOOD DATE')[0].querySelector('[data-testid="row-date"]')!)).toBe(
      'Jan 5, 2026',
    );
  });

  it('should show the calendar date of the file, whatever offset the parser gave it', async () => {
    await setup({
      previews: {
        'capone-2026-01.csv': [
          preview('UTC MIDNIGHT', { date: '2026-01-05T00:00:00Z' }),
          preview('EASTERN MIDNIGHT', { date: '2026-01-05T00:00:00-05:00' }),
          preview('PLAIN DATE', { date: '2026-01-05' }),
          preview('LATE UTC', { date: '2026-01-31T23:30:00Z' }),
        ],
      },
    });

    const dateOf = (description: string): string =>
      text(rowsFor(description)[0].querySelector('[data-testid="row-date"]')!);
    expect(dateOf('UTC MIDNIGHT')).toBe('Jan 5, 2026');
    expect(dateOf('EASTERN MIDNIGHT')).toBe('Jan 5, 2026');
    expect(dateOf('PLAIN DATE')).toBe('Jan 5, 2026');
    expect(dateOf('LATE UTC')).toBe('Jan 31, 2026');
    // the editors' labels name the same date
    const labelId = rowsFor('UTC MIDNIGHT')[0]
      .querySelector('[data-testid="row-category"] [role="combobox"]')!
      .getAttribute('aria-labelledby')!;
    expect(text(document.getElementById(labelId)!)).toBe('Category for UTC MIDNIGHT, Jan 5, 2026');
  });

  it.skipIf(!inBrowser)(
    'should give merchant and category room at the dialog width, the description truncating first',
    async () => {
      const HOME = category(103, 'Home & Garden');
      const HOUSEHOLD = category(4, 'Household Supplies', HOME);
      await setup({
        previews: {
          'capone-2026-01.csv': [
            preview('A RATHER LONG RAW BANK DESCRIPTION FROM THE STATEMENT #000123 ATLANTA GA', {
              suggestedMerchant: WALGREENS,
              suggestedCategory: HOUSEHOLD,
            }),
            preview('KROGER'),
          ],
        },
      });
      fixture.nativeElement.style.display = 'block';
      fixture.nativeElement.style.width = '982px';
      await settle();

      for (const row of rows()) {
        const rowBox = row.getBoundingClientRect();
        expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
        const [merchantSelect, categorySelect] = all<HTMLElement>('p-select', row);
        for (const select of [merchantSelect, categorySelect]) {
          const box = select.getBoundingClientRect();
          expect(box.width).toBeGreaterThanOrEqual(200);
          expect(box.right).toBeLessThanOrEqual(rowBox.right);
          // the shown value or placeholder is not cut to an ellipsis
          const label = select.querySelector<HTMLElement>('.p-select-label')!;
          expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth);
        }
      }
      const [longRow] = rows();
      const categoryLabel = longRow.querySelector<HTMLElement>(
        '[data-testid="row-category"] .p-select-label',
      )!;
      expect(text(categoryLabel)).toBe('Household Supplies');
      // the full Parent / Child name stays available
      expect(categoryLabel.querySelector('[title]')!.getAttribute('title')).toBe(
        'Home & Garden / Household Supplies',
      );
      // the description gives way, with its full text on hover
      const description = longRow.querySelector<HTMLElement>('[data-testid="row-description"]')!;
      expect(description.scrollWidth).toBeGreaterThan(description.clientWidth);
      expect(description.getAttribute('title')).toContain('A RATHER LONG RAW BANK DESCRIPTION');
    },
  );
});
