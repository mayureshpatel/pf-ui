import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ApplyRulesDialogComponent} from './apply-rules-dialog.component';
import {RuleChangePreview} from '@models/category-rule.model';

describe('ApplyRulesDialogComponent', () => {
  let component: ApplyRulesDialogComponent;
  let fixture: ComponentFixture<ApplyRulesDialogComponent>;

  const preview = (description: string, oldValue: string, newValue: string): RuleChangePreview =>
    ({description, oldValue, newValue});

  const setPreviewItems = (items: RuleChangePreview[]): void => {
    fixture.componentRef.setInput('previewItems', items);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplyRulesDialogComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ApplyRulesDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('visible', true);
  });

  it('should create', () => {
    setPreviewItems([]);

    expect(component).toBeTruthy();
  });

  describe('totalCount', () => {
    it('should equal the number of preview items', () => {
      setPreviewItems([preview('AMZN', 'Uncategorized', 'Shopping'), preview('WALMART', '', 'Groceries')]);

      expect(component.totalCount()).toBe(2);
    });

    it('should be zero when nothing matches the ruleset', () => {
      setPreviewItems([]);

      expect(component.totalCount()).toBe(0);
    });
  });

  describe('isLargeUpdate', () => {
    it('should be false at exactly the 50-item threshold', () => {
      setPreviewItems(Array.from({length: 50}, (_, i) => preview(`txn ${i}`, '', 'Shopping')));

      expect(component.isLargeUpdate()).toBe(false);
    });

    it('should be true just above the 50-item threshold', () => {
      setPreviewItems(Array.from({length: 51}, (_, i) => preview(`txn ${i}`, '', 'Shopping')));

      expect(component.isLargeUpdate()).toBe(true);
    });
  });

  describe('onCancel', () => {
    it('should close the dialog without emitting confirm', () => {
      // arrange
      setPreviewItems([]);
      const confirmSpy = vi.fn();
      component.confirm.subscribe(confirmSpy);

      // act
      component.onCancel();

      // assert & verify
      expect(component.visible()).toBe(false);
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe('onConfirm', () => {
    it('should emit confirm without closing the dialog itself', () => {
      // arrange -- the actual apply-and-close sequence is the parent's responsibility, driven by
      // whether the real API call succeeds, matching every other dialog's `save`/`saved` pattern
      setPreviewItems([]);
      const confirmSpy = vi.fn();
      component.confirm.subscribe(confirmSpy);

      // act
      component.onConfirm();

      // assert & verify
      expect(confirmSpy).toHaveBeenCalled();
      expect(component.visible()).toBe(true);
    });
  });

  describe('rendering', () => {
    it('should show the zero-match state with no large-update warning', () => {
      // act
      setPreviewItems([]);

      // assert & verify
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('0 Transactions Identified');
      expect(text).not.toContain('Large batch detected');
      expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(0);
    });

    it('should singularize the summary label for exactly one match', () => {
      setPreviewItems([preview('AMZN', '', 'Shopping')]);

      expect(fixture.nativeElement.textContent).toContain('1 Transaction Identified');
    });

    it('should pluralize the summary label for more than one match', () => {
      setPreviewItems([preview('AMZN', '', 'Shopping'), preview('WALMART', '', 'Groceries')]);

      expect(fixture.nativeElement.textContent).toContain('2 Transactions Identified');
    });

    it('should show the large-batch warning once over 50 matches', () => {
      setPreviewItems(Array.from({length: 51}, (_, i) => preview(`txn ${i}`, '', 'Shopping')));

      expect(fixture.nativeElement.textContent).toContain('Large batch detected');
    });

    it("should render the field label in the header and summary copy", () => {
      fixture.componentRef.setInput('fieldLabel', 'Merchant');
      setPreviewItems([]);

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Apply Merchant Rules');
      expect(text).toContain('Merchant values will be assigned');
    });

    it("should default the field label to 'Value' when not provided", () => {
      setPreviewItems([]);

      expect(fixture.nativeElement.textContent).toContain('Apply Value Rules');
    });

    it("should render 'Unset' in place of a blank old value", () => {
      setPreviewItems([preview('AMZN', '', 'Shopping')]);

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Unset');
      expect(text).not.toContain('undefined');
    });

    it('should render the actual old value when present, not the Unset placeholder', () => {
      setPreviewItems([preview('AMZN', 'Uncategorized', 'Shopping')]);

      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Uncategorized');
      expect(text).not.toContain('Unset');
    });

    it('should render one ledger row per preview item with description and new value', () => {
      setPreviewItems([preview('AMZN MKTP US', 'Uncategorized', 'Shopping'), preview('WALMART', '', 'Groceries')]);

      const rows = fixture.nativeElement.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('AMZN MKTP US');
      expect(text).toContain('Shopping');
      expect(text).toContain('WALMART');
      expect(text).toContain('Groceries');
    });
  });
});
