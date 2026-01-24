export interface VendorRule {
  id: number;
  keyword: string;
  vendorName: string;
  priority: number;
}

export interface VendorRuleFormData {
  keyword: string;
  vendorName: string;
  priority: number;
}
