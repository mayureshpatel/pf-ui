import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { MerchantDescriptionLinksDialogComponent } from './merchant-description-links-dialog.component';
import { MerchantApiService } from '../../services/merchant-api.service';
import { ToastService } from '@core/services/toast.service';
import { Merchant, MerchantDescriptionLink } from '@models/merchant.model';

describe('MerchantDescriptionLinksDialogComponent', () => {
  let component: MerchantDescriptionLinksDialogComponent;
  let fixture: ComponentFixture<MerchantDescriptionLinksDialogComponent>;
  let mockMerchantApi: any;
  let mockToast: any;

  const mockMerchant: Merchant = {
    id: 7,
    userId: 1,
    name: 'Starbucks',
    city: null,
    state: null,
    postalCode: null,
    country: null,
  };

  const linkA: MerchantDescriptionLink = { id: 1, merchantId: 7, description: 'STARBUCKS #1' };
  const linkB: MerchantDescriptionLink = { id: 2, merchantId: 7, description: 'STARBUCKS #2' };

  beforeEach(async () => {
    mockMerchantApi = {
      getDescriptionLinks: vi.fn().mockReturnValue(of([linkA, linkB])),
      addDescriptionLink: vi.fn().mockReturnValue(of(undefined)),
      deleteDescriptionLink: vi.fn().mockReturnValue(of(undefined)),
    };
    mockToast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [MerchantDescriptionLinksDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MerchantApiService, useValue: mockMerchantApi },
        { provide: ToastService, useValue: mockToast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MerchantDescriptionLinksDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('merchant', mockMerchant);
    fixture.componentRef.setInput('visible', false);
  });

  it('should create', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component).toBeTruthy();
  });

  it('should load the links when the dialog opens', () => {
    // act
    component.visible.set(true);
    fixture.detectChanges();

    // assert & verify
    expect(mockMerchantApi.getDescriptionLinks).toHaveBeenCalledWith(7);
    expect(component.links()).toEqual([linkA, linkB]);
  });

  it('should toast an error when loading fails', () => {
    // arrange
    mockMerchantApi.getDescriptionLinks.mockReturnValue(throwError(() => new Error('boom')));

    // act
    component.visible.set(true);
    fixture.detectChanges();

    // assert & verify
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load linked descriptions');
  });

  describe('addLink', () => {
    beforeEach(() => {
      component.visible.set(true);
      fixture.detectChanges();
    });

    it('should link the typed description and reload the list', () => {
      // arrange
      component.newDescription.set('NEW STORE #5');

      // act
      component.addLink();

      // assert & verify
      expect(mockMerchantApi.addDescriptionLink).toHaveBeenCalledWith(7, 'NEW STORE #5');
      expect(mockToast.success).toHaveBeenCalledWith('Description linked');
      expect(component.newDescription()).toBe('');
      expect(mockMerchantApi.getDescriptionLinks).toHaveBeenCalledTimes(2);
    });

    it('should do nothing when the input is blank', () => {
      // arrange
      component.newDescription.set('   ');

      // act
      component.addLink();

      // assert & verify
      expect(mockMerchantApi.addDescriptionLink).not.toHaveBeenCalled();
    });

    it('should show an error and keep the input when linking fails', () => {
      // arrange
      mockMerchantApi.addDescriptionLink.mockReturnValue(
        throwError(() => ({ error: { detail: 'Description too long.' } })),
      );
      component.newDescription.set('NEW STORE #5');

      // act
      component.addLink();

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Description too long.');
      expect(component.newDescription()).toBe('NEW STORE #5');
    });
  });

  describe('deleteLink', () => {
    beforeEach(() => {
      component.visible.set(true);
      fixture.detectChanges();
    });

    it('should remove the link locally and toast success', () => {
      // act
      component.deleteLink(linkA);

      // assert & verify
      expect(mockMerchantApi.deleteDescriptionLink).toHaveBeenCalledWith(7, 1);
      expect(component.links()).toEqual([linkB]);
      expect(mockToast.success).toHaveBeenCalledWith('Link removed');
    });

    it('should toast an error and leave the list untouched when deletion fails', () => {
      // arrange
      mockMerchantApi.deleteDescriptionLink.mockReturnValue(
        throwError(() => ({ error: { detail: 'Link not found.' } })),
      );

      // act
      component.deleteLink(linkA);

      // assert & verify
      expect(mockToast.error).toHaveBeenCalledWith('Link not found.');
      expect(component.links()).toEqual([linkA, linkB]);
    });
  });

  it('should clear the pending input when the dialog is closed', () => {
    // arrange
    component.visible.set(true);
    fixture.detectChanges();
    component.newDescription.set('typed but not submitted');

    // act
    component.onHide();

    // assert & verify
    expect(component.visible()).toBe(false);
    expect(component.newDescription()).toBe('');
  });
});
