import { TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { App } from './app';
import { FinancePreset } from './custom-presets';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [MessageService, ConfirmationService],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  // PF-870: Lighthouse `aria-dialog-name`. PrimeNG's confirm dialog puts role="alertdialog" on
  // its always-present <p-dialog> host as well as on the visible container, and the host has no
  // name. Every alertdialog in the document must be named, whether or not a confirmation is open.
  describe('shared confirm dialog accessible name', () => {
    function unnamedAlertDialogs(): string[] {
      return Array.from(document.querySelectorAll<HTMLElement>('[role="alertdialog"]'))
        .filter((el) => {
          const labelledBy = el.getAttribute('aria-labelledby');
          const labelEl = labelledBy ? document.getElementById(labelledBy) : null;
          const named = !!el.getAttribute('aria-label')?.trim() || !!labelEl?.textContent?.trim();
          return !named;
        })
        .map((el) => el.outerHTML.slice(0, 120));
    }

    it('should not leave an unnamed alertdialog in the page while closed', async () => {
      // arrange
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();

      // assert & verify
      expect(unnamedAlertDialogs()).toEqual([]);
    });

    it('should not leave an unnamed alertdialog in the page while a confirmation is open', async () => {
      // arrange
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();

      // act
      TestBed.inject(ConfirmationService).confirm({
        header: 'Delete tag?',
        message: 'This cannot be undone.',
      });
      fixture.detectChanges();
      await fixture.whenStable();

      // assert & verify
      expect(unnamedAlertDialogs()).toEqual([]);
    });
  });

  // PF-898 live check D5: on a phone the confirmation touched both screen edges.
  describe('with the app theme', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [providePrimeNG({ theme: { preset: FinancePreset } })],
      });
    });

    it.skipIf(/jsdom/i.test(navigator.userAgent))(
      'should keep a side margin around a confirmation on a phone',
      async () => {
        const { page } = await import('vitest/browser');
        await page.viewport(375, 812);
        try {
          // arrange
          const fixture = TestBed.createComponent(App);
          await fixture.whenStable();

          // act
          TestBed.inject(ConfirmationService).confirm({
            header: 'Discard import?',
            message: 'The files you chose and any edits you made will be lost. Discard them?',
            acceptLabel: 'Discard',
            rejectLabel: 'Keep importing',
          });
          fixture.detectChanges();
          await fixture.whenStable();

          // assert & verify
          // measured once the opening (scale) animation has finished
          const box = await vi.waitFor((): DOMRect => {
            const el = document.querySelector<HTMLElement>('.p-confirmdialog');
            const rect = el?.getBoundingClientRect();
            if (!el || !rect || rect.width === 0) throw new Error('not shown yet');
            if (Math.abs(rect.width - el.offsetWidth) > 0.5) throw new Error('still animating');
            return rect;
          });
          expect(box.left).toBeGreaterThanOrEqual(12);
          expect(box.right).toBeLessThanOrEqual(375 - 12);
          fixture.destroy();
        } finally {
          await page.viewport(1280, 800);
        }
      },
    );
  });
});
