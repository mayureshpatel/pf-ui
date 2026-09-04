import {vi} from 'vitest';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {of, throwError} from 'rxjs';

import {MerchantsComponent} from './merchants.component';
import {MerchantApiService} from './services/merchant-api.service';
import {ToastService} from '@core/services/toast.service';
import {Merchant} from '@models/merchant.model';

describe('MerchantsComponent', () => {
  let component: MerchantsComponent;
  let fixture: ComponentFixture<MerchantsComponent>;
  let mockMerchantApi: any;
  let mockToast: any;

  const mockMerchants: Merchant[] = [
    {id: 1, userId: 1, originalName: 'STARBUCKS #1234', cleanName: 'Starbucks'},
    {id: 2, userId: 1, originalName: 'WHOLEFDS 5678', cleanName: 'Whole Foods'},
    {id: 3, userId: 1, originalName: 'CHEVRON 00123 WA', cleanName: 'Chevron'}
  ];

  beforeEach(async () => {
    mockMerchantApi = {
      getMerchants: vi.fn().mockReturnValue(of(mockMerchants)),
      updateMerchant: vi.fn()
    };
    mockToast = {success: vi.fn(), error: vi.fn()};

    await TestBed.configureTestingModule({
      imports: [MerchantsComponent, NoopAnimationsModule],
      providers: [
        {provide: MerchantApiService, useValue: mockMerchantApi},
        {provide: ToastService, useValue: mockToast}
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MerchantsComponent);
    component = fixture.componentInstance;
  });

  it('should create and load merchants on init', () => {
    // act
    fixture.detectChanges();

    // assert & verify
    expect(component).toBeTruthy();
    expect(mockMerchantApi.getMerchants).toHaveBeenCalled();
    expect(component.merchants()).toEqual(mockMerchants);
  });

  it('should show an error toast when loading fails', () => {
    // arrange
    mockMerchantApi.getMerchants.mockReturnValue(throwError(() => new Error('network error')));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load merchants');
    expect(component.loading()).toBe(false);
  });

  it('should treat an empty merchant list, once loaded, as isEmpty', () => {
    // arrange
    mockMerchantApi.getMerchants.mockReturnValue(of([]));

    // act
    fixture.detectChanges();

    // assert & verify
    expect(component.isEmpty()).toBe(true);
  });

  describe('search filtering', () => {
    beforeEach(() => fixture.detectChanges());

    it('should match on the display (clean) name', () => {
      // act
      component.searchTerm.set('starbu');

      // assert & verify
      expect(component.filteredMerchants().map(m => m.id)).toEqual([1]);
    });

    it('should match on the original bank description, case-insensitively', () => {
      // act
      component.searchTerm.set('wholefds');

      // assert & verify
      expect(component.filteredMerchants().map(m => m.id)).toEqual([2]);
    });

    it('should return every merchant, sorted by display name, when the search term is empty', () => {
      // act
      component.searchTerm.set('');

      // assert & verify
      expect(component.filteredMerchants().map(m => m.cleanName)).toEqual(['Chevron', 'Starbucks', 'Whole Foods']);
    });

    it('should report noSearchResults when a search matches nothing, distinct from isEmpty', () => {
      // act
      component.searchTerm.set('nonexistent merchant');

      // assert & verify
      expect(component.filteredMerchants()).toEqual([]);
      expect(component.noSearchResults()).toBe(true);
      expect(component.isEmpty()).toBe(false);
    });
  });

  it('should open the edit dialog with the selected merchant', () => {
    // arrange
    fixture.detectChanges();

    // act
    component.openEditDialog(mockMerchants[1]);

    // assert & verify
    expect(component.selectedMerchant()).toEqual(mockMerchants[1]);
    expect(component.showDialog()).toBe(true);
  });

  it('should reload merchants when onSave is called', () => {
    // arrange
    fixture.detectChanges();
    mockMerchantApi.getMerchants.mockClear();

    // act
    component.onSave();

    // assert & verify
    expect(mockMerchantApi.getMerchants).toHaveBeenCalledTimes(1);
  });
});
