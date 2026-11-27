import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Store Admin'),
  role: text('role').notNull().default('admin'), // admin | manager | cashier | accountant
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull(),
  name: text('name').notNull(),
  gstin: text('gstin').notNull(),
  stateCode: text('state_code').notNull().default('07'),
  stateName: text('state_name').notNull().default('Delhi'),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  currency: text('currency').notNull().default('INR'),
  financialYear: text('financial_year').notNull().default('2026-27'),
  fyLocked: boolean('fy_locked').notNull().default(false),
  branchName: text('branch_name').notNull().default('Main Flagship Store'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const ledgers = pgTable('ledgers', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  groupType: text('group_type').notNull(), // Customer | Supplier | Bank | Cash | Expense | Income | Tax
  gstin: text('gstin').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  address: text('address').notNull().default(''),
  stateCode: text('state_code').notNull().default('07'),
  openingBalance: doublePrecision('opening_balance').notNull().default(0),
  currentBalance: doublePrecision('current_balance').notNull().default(0),
  balanceType: text('balance_type').notNull().default('Dr'), // Dr | Cr
  creditLimit: doublePrecision('credit_limit').notNull().default(0),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  sku: text('sku').notNull(),
  barcode: text('barcode').notNull(),
  name: text('name').notNull(),
  brand: text('brand').notNull().default('Generic'),
  category: text('category').notNull().default('General'),
  hsnCode: text('hsn_code').notNull().default('10063020'),
  uqc: text('uqc').notNull().default('PCS'),
  rackLocation: text('rack_location').notNull().default('Aisle-1'),
  taxSlab: doublePrecision('tax_slab').notNull().default(5),
  mrp: doublePrecision('mrp').notNull().default(0),
  saleRate: doublePrecision('sale_rate').notNull().default(0),
  purchaseRate: doublePrecision('purchase_rate').notNull().default(0),
  wholesaleRate: doublePrecision('wholesale_rate').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(15),
  isWeighed: boolean('is_weighed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const itemBatches = pgTable('item_batches', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  itemId: integer('item_id')
    .references(() => items.id, { onDelete: 'cascade' })
    .notNull(),
  godownName: text('godown_name').notNull().default('Main Store'),
  batchNo: text('batch_no').notNull(),
  serialNo: text('serial_no').notNull().default(''),
  expiryDate: text('expiry_date').notNull(), // YYYY-MM-DD
  qtyOnHand: doublePrecision('qty_on_hand').notNull().default(0),
  costRate: doublePrecision('cost_rate').notNull().default(0),
  mrp: doublePrecision('mrp').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const bomRecipes = pgTable('bom_recipes', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  finishedItemName: text('finished_item_name').notNull(),
  recipeCode: text('recipe_code').notNull(),
  yieldQty: integer('yield_qty').notNull().default(1),
  yieldUqc: text('yield_uqc').notNull().default('BOX'),
  componentsJson: text('components_json').notNull(),
  laborCost: doublePrecision('labor_cost').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const schemes = pgTable('schemes', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  barcodeOrCategory: text('barcode_or_category').notNull(),
  schemeType: text('scheme_type').notNull().default('PERCENT_DISCOUNT'), // PERCENT_DISCOUNT | BUY_X_GET_Y
  minQty: integer('min_qty').notNull().default(1),
  freeQty: integer('free_qty').notNull().default(0),
  discountPercent: doublePrecision('discount_percent').notNull().default(0),
  validFrom: text('valid_from').notNull(),
  validTo: text('valid_to').notNull(),
  active: boolean('active').notNull().default(true),
});

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  invoiceNo: text('invoice_no').notNull(),
  docType: text('doc_type').notNull().default('POS_BILL'), // POS_BILL | GST_INVOICE | ESTIMATE | SALES_ORDER | CHALLAN | CREDIT_NOTE
  counterCode: text('counter_code').notNull().default('POS-01'),
  ledgerId: integer('ledger_id'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull().default(''),
  customerGstin: text('customer_gstin').notNull().default(''),
  invoiceDate: text('invoice_date').notNull(),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  discountAmount: doublePrecision('discount_amount').notNull().default(0),
  cgstAmount: doublePrecision('cgst_amount').notNull().default(0),
  sgstAmount: doublePrecision('sgst_amount').notNull().default(0),
  igstAmount: doublePrecision('igst_amount').notNull().default(0),
  roundOff: doublePrecision('round_off').notNull().default(0),
  grandTotal: doublePrecision('grand_total').notNull().default(0),
  loyaltyEarned: integer('loyalty_earned').notNull().default(0),
  loyaltyRedeemed: integer('loyalty_redeemed').notNull().default(0),
  paymentModeSummary: text('payment_mode_summary').notNull().default('Cash'),
  paymentsJson: text('payments_json').notNull().default('[]'),
  itemsJson: text('items_json').notNull().default('[]'),
  irn: text('irn').notNull().default(''),
  ewayBillNo: text('eway_bill_no').notNull().default(''),
  status: text('status').notNull().default('Paid'), // Paid | Partial | Unpaid | Returned
  createdByUid: text('created_by_uid').notNull().default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  billNo: text('bill_no').notNull(),
  docType: text('doc_type').notNull().default('PURCHASE_BILL'), // PURCHASE_BILL | PURCHASE_ORDER | DEBIT_NOTE
  ledgerId: integer('ledger_id'),
  supplierName: text('supplier_name').notNull(),
  supplierGstin: text('supplier_gstin').notNull().default(''),
  billDate: text('bill_date').notNull(),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  taxAmount: doublePrecision('tax_amount').notNull().default(0),
  grandTotal: doublePrecision('grand_total').notNull().default(0),
  itemsJson: text('items_json').notNull().default('[]'),
  importSource: text('import_source').notNull().default('Manual'), // Manual | CSV | Excel | PDF
  status: text('status').notNull().default('Posted'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const vouchers = pgTable('vouchers', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  voucherNo: text('voucher_no').notNull(),
  voucherType: text('voucher_type').notNull(), // Receipt | Payment | Contra | Journal | Debit Note | Credit Note
  voucherDate: text('voucher_date').notNull(),
  debitLedgerName: text('debit_ledger_name').notNull(),
  creditLedgerName: text('credit_ledger_name').notNull(),
  amount: doublePrecision('amount').notNull().default(0),
  narration: text('narration').notNull().default(''),
  referenceInvoiceNo: text('reference_invoice_no').notNull().default(''),
  paymentMode: text('payment_mode').notNull().default('Bank Transfer'),
  chequeNo: text('cheque_no').notNull().default(''),
  pdcDate: text('pdc_date').notNull().default(''),
  reconciled: boolean('reconciled').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  movementType: text('movement_type').notNull(), // TRANSFER | ADJUSTMENT | DUMP
  itemName: text('item_name').notNull(),
  batchNo: text('batch_no').notNull(),
  fromGodown: text('from_godown').notNull(),
  toGodown: text('to_godown').notNull().default(''),
  qtyDelta: doublePrecision('qty_delta').notNull(),
  reason: text('reason').notNull().default(''),
  movementDate: text('movement_date').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const crmRecords = pgTable('crm_records', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  channel: text('channel').notNull().default('CRM_LEAD'), // CRM_LEAD | MARG_MART_ORDER
  customerName: text('customer_name').notNull(),
  phone: text('phone').notNull(),
  stage: text('stage').notNull().default('New'), // New | Follow-Up | Quoted | Confirmed | Dispatched | Won
  orderValue: doublePrecision('order_value').notNull().default(0),
  nextFollowUp: text('next_follow_up').notNull().default(''),
  notes: text('notes').notNull().default(''),
  itemsSummary: text('items_summary').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const posCounters = pgTable('pos_counters', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  counterCode: text('counter_code').notNull(),
  counterName: text('counter_name').notNull(),
  operatorName: text('operator_name').notNull(),
  operatorRole: text('operator_role').notNull().default('Cashier'),
  openingCash: doublePrecision('opening_cash').notNull().default(5000),
  cashSales: doublePrecision('cash_sales').notNull().default(0),
  upiSales: doublePrecision('upi_sales').notNull().default(0),
  cardSales: doublePrecision('card_sales').notNull().default(0),
  walletSales: doublePrecision('wallet_sales').notNull().default(0),
  pdcSales: doublePrecision('pdc_sales').notNull().default(0),
  status: text('status').notNull().default('OPEN'), // OPEN | CLOSED
  lastClosedAt: text('last_closed_at').notNull().default(''),
});

export const controlRoomSettings = pgTable('control_room_settings', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  autoApplySchemes: boolean('auto_apply_schemes').notNull().default(true),
  enableLoyaltyPoints: boolean('enable_loyalty_points').notNull().default(true),
  loyaltyEarnPer100: integer('loyalty_earn_per_100').notNull().default(2),
  loyaltyPointValue: doublePrecision('loyalty_point_value').notNull().default(1),
  allowNegativeStock: boolean('allow_negative_stock').notNull().default(false),
  multiCounterEnabled: boolean('multi_counter_enabled').notNull().default(true),
  requireBatchOnBilling: boolean('require_batch_on_billing').notNull().default(true),
  nearExpiryAlertDays: integer('near_expiry_alert_days').notNull().default(30),
  eInvoiceAutoIrn: boolean('e_invoice_auto_irn').notNull().default(true),
  invoiceHeaderTitle: text('invoice_header_title')
    .notNull()
    .default('SUPERMARKET TAX INVOICE / RETAIL BILL'),
  invoiceTerms: text('invoice_terms')
    .notNull()
    .default(
      'Fresh produce & dairy items cannot be returned after checkout. Packaged items exchangeable within 7 days with original bill.'
    ),
  thermalPaperWidth: text('thermal_paper_width').notNull().default('80mm'),
  lastBooksRebuildAt: text('last_books_rebuild_at').notNull().default('2026-11-26 09:00'),
  lastBackupAt: text('last_backup_at').notNull().default('2026-11-26 18:30'),
});

export const shiftHandovers = pgTable('shift_handovers', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  counterCode: text('counter_code').notNull(),
  counterName: text('counter_name').notNull(),
  outgoingOperator: text('outgoing_operator').notNull(),
  outgoingRole: text('outgoing_role').notNull().default('POS Cashier'),
  incomingOperator: text('incoming_operator').notNull(),
  shiftStatus: text('shift_status').notNull().default('HANDED_OVER'), // HANDED_OVER | CLOSED | OPENED
  openingCash: doublePrecision('opening_cash').notNull().default(0),
  cashSales: doublePrecision('cash_sales').notNull().default(0),
  upiSales: doublePrecision('upi_sales').notNull().default(0),
  cardSales: doublePrecision('card_sales').notNull().default(0),
  walletSales: doublePrecision('wallet_sales').notNull().default(0),
  pdcSales: doublePrecision('pdc_sales').notNull().default(0),
  expectedCash: doublePrecision('expected_cash').notNull().default(0),
  countedCash: doublePrecision('counted_cash').notNull().default(0),
  cashVariance: doublePrecision('cash_variance').notNull().default(0),
  notes: text('notes').notNull().default(''),
  handedOverAt: text('handed_over_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companiesRelations = relations(companies, ({ many, one }) => ({
  ledgers: many(ledgers),
  items: many(items),
  batches: many(itemBatches),
  invoices: many(invoices),
  purchases: many(purchases),
  vouchers: many(vouchers),
  posCounters: many(posCounters),
  shiftHandovers: many(shiftHandovers),
  controlRoom: one(controlRoomSettings, {
    fields: [companies.id],
    references: [controlRoomSettings.companyId],
  }),
}));

export const itemsRelations = relations(items, ({ many, one }) => ({
  company: one(companies, {
    fields: [items.companyId],
    references: [companies.id],
  }),
  batches: many(itemBatches),
}));

export const itemBatchesRelations = relations(itemBatches, ({ one }) => ({
  item: one(items, {
    fields: [itemBatches.itemId],
    references: [items.id],
  }),
}));
