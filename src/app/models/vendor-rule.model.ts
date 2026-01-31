export interface VendorRule {
  id: number;
  keyword: string;
  vendorName: string;
  priority: number;
}

export interface VendorRuleDto {
  keyword: string;
  vendorName: string;
  priority?: number;
}

export interface UnmatchedVendor {
  originalName: string;
  count: number;
}