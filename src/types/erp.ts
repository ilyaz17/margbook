export type ModuleId =
  | 'dashboard'
  | 'pos'
  | 'masters'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'accounting'
  | 'banking'
  | 'gst'
  | 'crm'
  | 'reports'
  | 'control-room'
  | 'shifts'
  | 'barcodes'
  | 'company-setup'
  | 'search';

export type UserAccessRole = 'admin' | 'manager' | 'cashier' | 'accountant';

export interface Company {
  id: number;
  name: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  address: string;
  phone: string;
  currency: string;
  financialYear: string;
  fyLocked: boolean;
  branchName: string;
}

export type LedgerGroup =
  | 'Customer'
  | 'Supplier'
  | 'Bank'
  | 'Cash'
  | 'Expense'
  | 'Income'
  | 'Tax';

export interface Ledger {
  id: number;
  companyId: number;
  name: string;
  groupType: LedgerGroup;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  stateCode: string;
  openingBalance: number;
  currentBalance: number;
  balanceType: 'Dr' | 'Cr';
  creditLimit: number;
  loyaltyPoints: number;
}

export interface InventoryItem {
  id: number;
  companyId: number;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  hsnCode: string;
  uqc: string;
  rackLocation: string;
  taxSlab: number;
  mrp: number;
  saleRate: number;
  purchaseRate: number;
  wholesaleRate: number;
  reorderLevel: number;
  isWeighed: boolean;
}

export interface ItemBatch {
  id: number;
  companyId: number;
  itemId: number;
  godownName: string;
  batchNo: string;
  serialNo: string;
  expiryDate: string; // YYYY-MM-DD
  qtyOnHand: number;
  costRate: number;
  mrp: number;
}

export interface BomComponent {
  itemName: string;
  qty: number;
  uqc: string;
  unitCost: number;
}

export interface BomRecipe {
  id: number;
  companyId: number;
  finishedItemName: string;
  recipeCode: string;
  yieldQty: number;
  yieldUqc: string;
  components: BomComponent[];
  laborCost: number;
}

export interface Scheme {
  id: number;
  companyId: number;
  name: string;
  barcodeOrCategory: string;
  schemeType: 'PERCENT_DISCOUNT' | 'BUY_X_GET_Y';
  minQty: number;
  freeQty: number;
  discountPercent: number;
  validFrom: string;
  validTo: string;
  active: boolean;
}

export interface PromoCoupon {
  id: number;
  companyId: number;
  code: string;
  description: string;
  discountType: 'FLAT' | 'PERCENT';
  discountValue: number;
  minBillAmount: number;
  maxDiscount: number;
  validTill: string;
  active: boolean;
}

export interface InvoiceLineItem {
  itemId: number;
  barcode: string;
  name: string;
  hsnCode: string;
  batchNo: string;
  expiryDate: string;
  uqc: string;
  qty: number;
  freeQty: number;
  mrp: number;
  rate: number;
  discountPercent: number;
  discountAmount: number;
  taxSlab: number;
  taxableValue: number;
  taxAmount: number;
  lineTotal: number;
  mrpSavings?: number;
  appliedSchemeName?: string;
}

export interface HeldCart {
  id: string;
  label: string;
  customerId: number;
  customerName: string;
  heldAt: string;
  itemCount: number;
  estimatedTotal: number;
  lines: Array<{
    itemId: number;
    batchNo: string;
    expiryDate: string;
    qty: number;
    rateOverride?: number;
    manualDiscountPercent?: number;
  }>;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Card' | 'Wallet' | 'PDC' | 'Credit';

export interface PaymentSplit {
  mode: PaymentMode;
  amount: number;
  reference?: string;
}

export type SaleDocType =
  | 'POS_BILL'
  | 'GST_INVOICE'
  | 'ESTIMATE'
  | 'SALES_ORDER'
  | 'CHALLAN'
  | 'CREDIT_NOTE';

export interface InvoiceRecord {
  id: number;
  companyId: number;
  invoiceNo: string;
  docType: SaleDocType;
  counterCode: string;
  ledgerId: number | null;
  customerName: string;
  customerPhone: string;
  customerGstin: string;
  invoiceDate: string;
  subtotal: number;
  discountAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOff: number;
  grandTotal: number;
  loyaltyEarned: number;
  loyaltyRedeemed: number;
  couponCode?: string;
  couponDiscount?: number;
  paymentModeSummary: string;
  payments: PaymentSplit[];
  items: InvoiceLineItem[];
  irn: string;
  ewayBillNo: string;
  status: 'Paid' | 'Partial' | 'Unpaid' | 'Returned';
}

export type PurchaseDocType = 'PURCHASE_BILL' | 'PURCHASE_ORDER' | 'DEBIT_NOTE';

export interface PurchaseLineItem {
  itemName: string;
  barcode: string;
  hsnCode: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  rate: number;
  taxSlab: number;
  lineTotal: number;
}

export interface PurchaseRecord {
  id: number;
  companyId: number;
  billNo: string;
  docType: PurchaseDocType;
  ledgerId: number | null;
  supplierName: string;
  supplierGstin: string;
  billDate: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  items: PurchaseLineItem[];
  importSource: 'Manual' | 'CSV' | 'Excel' | 'PDF';
  status: 'Posted' | 'Draft' | 'Returned';
}

export type VoucherType =
  | 'Receipt'
  | 'Payment'
  | 'Contra'
  | 'Journal'
  | 'Debit Note'
  | 'Credit Note';

export interface VoucherRecord {
  id: number;
  companyId: number;
  voucherNo: string;
  voucherType: VoucherType;
  voucherDate: string;
  debitLedgerName: string;
  creditLedgerName: string;
  amount: number;
  narration: string;
  referenceInvoiceNo: string;
  paymentMode: string;
  chequeNo: string;
  pdcDate: string;
  reconciled: boolean;
}

export interface StockMovement {
  id: number;
  companyId: number;
  movementType: 'TRANSFER' | 'ADJUSTMENT' | 'DUMP';
  itemName: string;
  batchNo: string;
  fromGodown: string;
  toGodown: string;
  qtyDelta: number;
  reason: string;
  movementDate: string;
}

export interface CrmRecord {
  id: number;
  companyId: number;
  channel: 'CRM_LEAD' | 'MARG_MART_ORDER';
  customerName: string;
  phone: string;
  stage: 'New' | 'Follow-Up' | 'Quoted' | 'Confirmed' | 'Dispatched' | 'Won';
  orderValue: number;
  nextFollowUp: string;
  notes: string;
  itemsSummary: string;
}

export interface PosCounter {
  id: number;
  companyId: number;
  counterCode: string;
  counterName: string;
  operatorName: string;
  operatorRole: string;
  openingCash: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  walletSales: number;
  pdcSales: number;
  creditSales?: number;
  status: 'OPEN' | 'CLOSED';
  lastClosedAt: string;
}

export interface ControlRoomConfig {
  id: number;
  companyId: number;
  autoApplySchemes: boolean;
  enableLoyaltyPoints: boolean;
  loyaltyEarnPer100: number;
  loyaltyPointValue: number;
  allowNegativeStock: boolean;
  multiCounterEnabled: boolean;
  requireBatchOnBilling: boolean;
  nearExpiryAlertDays: number;
  eInvoiceAutoIrn: boolean;
  invoiceHeaderTitle: string;
  invoiceTerms: string;
  thermalPaperWidth: '58mm' | '80mm' | 'A4';
  upiVpa: string;
  weightedBarcodePrefix: string;
  lastBooksRebuildAt: string;
  lastBackupAt: string;
}

export interface OperatorRole {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Store Manager' | 'POS Cashier' | 'GST Accountant';
  countersAllowed: string[];
  canEditControlRoom: boolean;
  canApproveReturns: boolean;
  canLockFy: boolean;
  active: boolean;
}

export interface ShiftHandoverRecord {
  id: number;
  companyId: number;
  counterCode: string;
  counterName: string;
  outgoingOperator: string;
  outgoingRole: string;
  incomingOperator: string;
  shiftStatus: 'HANDED_OVER' | 'CLOSED' | 'OPENED';
  openingCash: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  walletSales: number;
  pdcSales: number;
  expectedCash: number;
  countedCash: number;
  cashVariance: number;
  notes: string;
  handedOverAt: string;
}

export interface WorkspaceData {
  companies: Company[];
  activeCompanyId: number;
  currentUserRole: UserAccessRole;
  ledgers: Ledger[];
  items: InventoryItem[];
  batches: ItemBatch[];
  bomRecipes: BomRecipe[];
  schemes: Scheme[];
  promoCoupons: PromoCoupon[];
  invoices: InvoiceRecord[];
  purchases: PurchaseRecord[];
  vouchers: VoucherRecord[];
  stockMovements: StockMovement[];
  crmRecords: CrmRecord[];
  posCounters: PosCounter[];
  shiftHandovers: ShiftHandoverRecord[];
  controlRoom: ControlRoomConfig;
  operators: OperatorRole[];
}

export interface CustomerDisplaySnapshot {
  updatedAt: string;
  storeName: string;
  branchName: string;
  counterCode: string;
  customerName: string;
  upiVpa: string;
  lines: Array<{
    name: string;
    qty: number;
    uqc: string;
    mrp: number;
    rate: number;
    lineTotal: number;
  }>;
  subtotal: number;
  totalTax: number;
  couponCode: string;
  couponDiscount: number;
  loyaltyDiscount: number;
  totalMrpSavings: number;
  grandTotal: number;
  upiAmount: number;
  status: 'IDLE' | 'SCANNING' | 'AWAITING_PAYMENT' | 'PAID';
  lastInvoiceNo?: string;
}
