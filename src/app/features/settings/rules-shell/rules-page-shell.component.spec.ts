import { ChangeDetectionStrategy, Component, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RulePanelMode, RulesPageShellComponent } from './rules-page-shell.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RulesPageShellComponent],
  template: `
    <app-rules-page-shell
      heading="Category rules"
      nounText="category rules"
      emptyText="Nothing yet."
      overviewText="Overview copy."
      [rulesCount]="count()"
      [visibleCount]="visible()"
      [loading]="loading()"
      [loadedOnce]="true"
      [loadError]="false"
      [applying]="false"
      [saving]="false"
      [panelMode]="mode()"
      panelTitle="Overview"
      [onlyAddMode]="false"
      [(search)]="search"
      (add)="adds = adds + 1"
      (apply)="applies = applies + 1"
    >
      <ul rows>
        <li>row</li>
      </ul>
      <div panel>form</div>
    </app-rules-page-shell>
  `,
})
class HostComponent {
  count: WritableSignal<number> = signal(3);
  visible: WritableSignal<number> = signal(3);
  loading: WritableSignal<boolean> = signal(false);
  mode: WritableSignal<RulePanelMode> = signal('overview');
  search: WritableSignal<string> = signal('');
  adds = 0;
  applies = 0;
}

describe('RulesPageShellComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const el = (): HTMLElement => fixture.nativeElement;
  const buttons = (label: string): HTMLElement[] =>
    Array.from(el().querySelectorAll<HTMLElement>('button')).filter(
      (b) => b.textContent?.trim() === label,
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should offer Add rule and Apply rules once, in the toolbar only', () => {
    expect(buttons('Add rule').length).toBe(1);
    expect(buttons('Apply rules').length).toBe(1);
  });

  it('should emit add and apply from the toolbar buttons', () => {
    buttons('Add rule')[0].click();
    buttons('Apply rules')[0].click();
    expect(host.adds).toBe(1);
    expect(host.applies).toBe(1);
  });

  it('should show the overview count and copy, and the rows', () => {
    expect(el().textContent).toContain('3 rules');
    expect(el().textContent).toContain('Overview copy.');
    expect(el().textContent).toContain('row');
    expect(el().textContent).not.toContain('form');
  });

  it('should show the projected form instead of the overview in an open panel', () => {
    host.mode.set('add');
    fixture.detectChanges();
    expect(el().textContent).toContain('form');
    expect(el().textContent).not.toContain('Overview copy.');
  });

  it('should show the empty copy when there are no rules', () => {
    host.count.set(0);
    host.visible.set(0);
    fixture.detectChanges();
    expect(el().textContent).toContain('No rules yet');
    expect(el().textContent).toContain('Nothing yet.');
  });

  it('should announce how many rules a search leaves, and stay silent without a search', () => {
    const status = (): string =>
      el().querySelector('p.sr-only[role="status"]')!.textContent!.trim();
    expect(status()).toBe('');
    host.search.set('net');
    host.visible.set(2);
    fixture.detectChanges();
    expect(status()).toBe('2 rules match');
    host.visible.set(1);
    fixture.detectChanges();
    expect(status()).toBe('1 rule matches');
  });

  it('should clear the search and give focus back to the search box', () => {
    host.search.set('zzz');
    host.visible.set(0);
    fixture.detectChanges();
    expect(el().textContent).toContain('No rules match');
    buttons('Clear search')[0].click();
    fixture.detectChanges();
    expect(host.search()).toBe('');
    expect(document.activeElement).toBe(el().querySelector('#rules-search'));
  });

  it('should not leave the page title as a tooltip on the host', () => {
    expect(el().querySelector('app-rules-page-shell')!.hasAttribute('title')).toBe(false);
  });

  it('should disable Apply rules when there are no rules', () => {
    expect((buttons('Apply rules')[0] as HTMLButtonElement).disabled).toBe(false);
    host.count.set(0);
    host.visible.set(0);
    fixture.detectChanges();
    expect((buttons('Apply rules')[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('should say the rules are refreshing while a reload runs', () => {
    host.loading.set(true);
    fixture.detectChanges();
    expect(el().textContent).toContain('Refreshing the rules');
  });
});
