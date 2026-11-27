import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGlobalSearchResults,
  buildGstr1PortalJson,
  calculateInvoiceTotals,
  calculateShiftVariance,
  classifyExpiryStatus,
  computeFinancialStatements,
  evaluateLineScheme,
  generateDeterministicIrn,
  parseBarcodeOrPluInput,
  parsePurchaseImportCsv,
  sanitizeNextPath,
  validateMultiPayments,
} from './erp-engine';
import type { InventoryItem, Scheme } from '../types/erp';

const sampleGroceryItem: InventoryItem = {
  id: 1,
  companyId: 1,
  sku: 'GRC-BISC-01',
  barcode: '8901063014121',
  name: 'Britannia Good Day Cashew 200g',
  brand: 'Britannia',
  category: 'Beverages & Snacks',
  hsnCode: '19053100',
  uqc: 'PKT',
  rackLocation: 'Aisle-4-B2',
  taxSlab: 12,
  mrp: 40,
  saleRate: 30,
  purchaseRate: 24,
  wholesaleRate: 27,
  reorderLevel: 50,
  isWeighed: false,
};

const sampleWeighedProduceItem: InventoryItem = {
  id: 2,
  companyId: 1,
  sku: 'VEG-TOM-01',
  barcode: '200101',
  name: 'Fresh Farm Tomatoes (Loose)',
  brand: 'FreshFarm Mandi',
  category: 'Fresh Produce',
  hsnCode: '07020000',
  uqc: 'KG',
  rackLocation: 'Produce-01',
  taxSlab: 0,
  mrp: 48,
  saleRate: 40,
  purchaseRate: 28,
  wholesaleRate: 34,
  reorderLevel: 25,
  isWeighed: true,
};

const sampleSchemes: Scheme[] = [
  {
    id: 1,
    companyId: 1,
    name: 'Snack Saver Buy 10 Get 1 Free',
    barcodeOrCategory: '8901063014121',
    schemeType: 'BUY_X_GET_Y',
    minQty: 10,
    freeQty: 1,
    discountPercent: 0,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    active: true,
  },
  {
    id: 2,
    companyId: 1,
    name: 'Weekend Snacks 5% Off',
    barcodeOrCategory: 'Beverages & Snacks',
    schemeType: 'PERCENT_DISCOUNT',
    minQty: 5,
    freeQty: 0,
    discountPercent: 5,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    active: true,
  },
];

test('evaluateLineScheme applies percentage discount and buy-X-get-Y free quantity', () => {
  const res = evaluateLineScheme(sampleGroceryItem, 20, sampleSchemes, true, '2026-11-26');
  assert.equal(res.discountPercent, 5);
  assert.equal(res.freeQty, 2);
  assert.ok(res.schemeName);

  const disabled = evaluateLineScheme(sampleGroceryItem, 20, sampleSchemes, false, '2026-11-26');
  assert.equal(disabled.discountPercent, 0);
  assert.equal(disabled.freeQty, 0);
});

test('calculateInvoiceTotals computes intra-state CGST/SGST, schemes, MRP savings, and loyalty', () => {
  const bill = calculateInvoiceTotals({
    cartLines: [
      {
        item: sampleGroceryItem,
        batchNo: 'BR26A',
        expiryDate: '2027-08-31',
        qty: 10,
      },
    ],
    schemes: sampleSchemes,
    autoApplySchemes: true,
    asOfDate: '2026-11-26',
    isInterState: false,
    redeemPoints: 20,
    availableCustomerPoints: 100,
    loyaltyPointValue: 1,
    loyaltyEarnPer100: 2,
    enableLoyaltyPoints: true,
  });

  // Gross = 10 * 30 = 300; 5% scheme discount = 15; taxable = 285
  // 12% GST on 285 = 34.20 -> CGST 17.10, SGST 17.10
  // Pre-loyalty = 319.20 - 20 loyalty = 299.20 -> rounded 299
  // MRP savings = (40 - 30) * 10 + 15 scheme + 20 loyalty = 135
  assert.equal(bill.subtotal, 300);
  assert.equal(bill.taxableTotal, 285);
  assert.equal(bill.cgstAmount, 17.1);
  assert.equal(bill.sgstAmount, 17.1);
  assert.equal(bill.igstAmount, 0);
  assert.equal(bill.loyaltyRedeemed, 20);
  assert.equal(bill.grandTotal, 299);
  assert.equal(bill.totalMrpSavings, 135);
  assert.equal(bill.loyaltyEarned, 5); // floor(299/100 * 2) = 5
  assert.equal(bill.lines[0].freeQty, 1);
});

test('calculateInvoiceTotals handles decimal loose-weight kg supermarket produce with 0% GST', () => {
  const bill = calculateInvoiceTotals({
    cartLines: [
      {
        item: sampleWeighedProduceItem,
        batchNo: 'FM-2611',
        expiryDate: '2026-12-03',
        qty: 1.25,
      },
    ],
    schemes: [],
    autoApplySchemes: true,
    asOfDate: '2026-11-26',
    isInterState: false,
    redeemPoints: 0,
    availableCustomerPoints: 0,
    loyaltyPointValue: 1,
    loyaltyEarnPer100: 2,
    enableLoyaltyPoints: false,
  });

  // 1.25 kg * ₹40 = ₹50.00, 0% GST, MRP savings = (48 - 40) * 1.25 = ₹10.00
  assert.equal(bill.lines[0].qty, 1.25);
  assert.equal(bill.subtotal, 50);
  assert.equal(bill.totalTax, 0);
  assert.equal(bill.grandTotal, 50);
  assert.equal(bill.totalMrpSavings, 10);
});

test('parseBarcodeOrPluInput parses qty*barcode multipliers and loose weights cleanly', () => {
  assert.deepEqual(parseBarcodeOrPluInput('3*8901262010016'), {
    qty: 3,
    query: '8901262010016',
  });
  assert.deepEqual(parseBarcodeOrPluInput('0.5*200101'), {
    qty: 0.5,
    query: '200101',
  });
  assert.deepEqual(parseBarcodeOrPluInput('8901262010016'), {
    qty: 1,
    query: '8901262010016',
  });
  assert.deepEqual(parseBarcodeOrPluInput('0*8901262010016'), {
    qty: 1,
    query: '0*8901262010016',
  });
});

test('calculateInvoiceTotals switches to IGST for inter-state B2B invoices', () => {
  const bill = calculateInvoiceTotals({
    cartLines: [
      {
        item: sampleGroceryItem,
        batchNo: 'BR26A',
        expiryDate: '2027-08-31',
        qty: 2,
      },
    ],
    schemes: [],
    autoApplySchemes: false,
    asOfDate: '2026-11-26',
    isInterState: true,
    redeemPoints: 0,
    availableCustomerPoints: 0,
    loyaltyPointValue: 1,
    loyaltyEarnPer100: 2,
    enableLoyaltyPoints: false,
  });

  assert.equal(bill.cgstAmount, 0);
  assert.equal(bill.sgstAmount, 0);
  assert.equal(bill.igstAmount, 7.2);
  assert.equal(bill.grandTotal, 67);
});

test('validateMultiPayments handles split Cash + UPI and catches underpayment', () => {
  const short = validateMultiPayments([{ mode: 'Cash', amount: 200 }], 350);
  assert.equal(short.valid, false);
  assert.equal(short.balanceDue, 150);

  const exactSplit = validateMultiPayments(
    [
      { mode: 'Cash', amount: 200 },
      { mode: 'UPI', amount: 150, reference: 'UPI99281' },
    ],
    350
  );
  assert.equal(exactSplit.valid, true);
  assert.equal(exactSplit.changeToReturn, 0);
  assert.equal(exactSplit.summaryLabel, 'Cash + UPI');
});

test('parsePurchaseImportCsv parses valid supermarket rows and reports malformed lines', () => {
  const csv = [
    'ItemName,Barcode,HSN,Batch,Expiry,Qty,Rate,TaxPct',
    'India Gate Basmati Rice 5kg,8901526100105,10063020,IG2609,2027-10-31,50,510,5',
    'BadRowOnlyThreeCols,123,10063020',
  ].join('\n');

  const parsed = parsePurchaseImportCsv(csv);
  assert.equal(parsed.lines.length, 1);
  assert.equal(parsed.subtotal, 25500);
  assert.equal(parsed.taxAmount, 1275);
  assert.equal(parsed.grandTotal, 26775);
  assert.equal(parsed.errors.length, 1);
});

test('classifyExpiryStatus distinguishes EXPIRED, NEAR_EXPIRY, and HEALTHY batches', () => {
  assert.equal(classifyExpiryStatus('2026-10-01', '2026-11-26', 30).status, 'EXPIRED');
  assert.equal(classifyExpiryStatus('2026-12-15', '2026-11-26', 30).status, 'NEAR_EXPIRY');
  assert.equal(classifyExpiryStatus('2028-05-01', '2026-11-26', 30).status, 'HEALTHY');
});

test('computeFinancialStatements produces balanced Trial Balance and deterministic GSTR-1 JSON', () => {
  const summary = computeFinancialStatements({
    ledgers: [
      {
        id: 1,
        companyId: 1,
        name: 'Cash-in-Hand',
        groupType: 'Cash',
        gstin: '',
        phone: '',
        email: '',
        address: '',
        stateCode: '29',
        openingBalance: 10000,
        currentBalance: 25000,
        balanceType: 'Dr',
        creditLimit: 0,
        loyaltyPoints: 0,
      },
      {
        id: 2,
        companyId: 1,
        name: 'Hindustan FMCG Supply Co.',
        groupType: 'Supplier',
        gstin: '29AABCH9911K1Z5',
        phone: '',
        email: '',
        address: '',
        stateCode: '29',
        openingBalance: 5000,
        currentBalance: 12000,
        balanceType: 'Cr',
        creditLimit: 100000,
        loyaltyPoints: 0,
      },
    ],
    invoices: [],
    purchases: [],
    vouchers: [],
    batches: [
      {
        id: 1,
        companyId: 1,
        itemId: 1,
        godownName: 'Main Supermarket Floor',
        batchNo: 'B1',
        serialNo: '',
        expiryDate: '2027-12-31',
        qtyOnHand: 100.5,
        costRate: 20,
        mrp: 40,
      },
    ],
  });

  assert.equal(summary.trialDebitTotal, summary.trialCreditTotal);
  assert.equal(summary.closingStockValue, 2010);
  assert.equal(summary.cashBankBalance, 25000);

  const irn = generateDeterministicIrn('29AABCF1429B1ZB', 'INV-26-001', '2026-11-26');
  assert.equal(irn.length, 64);

  const gstr1 = buildGstr1PortalJson('29AABCF1429B1ZB', '112026', []);
  assert.equal(gstr1.gstin, '29AABCF1429B1ZB');
  assert.equal(gstr1.fp, '112026');
});

test('sanitizeNextPath permits only internal /admin paths and blocks open redirects', () => {
  assert.equal(sanitizeNextPath('/admin/pos'), '/admin/pos');
  assert.equal(sanitizeNextPath('/admin/bills/1001'), '/admin/bills/1001');
  assert.equal(sanitizeNextPath('https://evil.example/phish'), '/admin/dashboard');
  assert.equal(sanitizeNextPath('//evil.example/admin'), '/admin/dashboard');
  assert.equal(sanitizeNextPath('/admin/../login'), '/admin/dashboard');
  assert.equal(sanitizeNextPath(null), '/admin/dashboard');
});

test('calculateShiftVariance accurately detects matched, excess, and shortage cash', () => {
  const matched = calculateShiftVariance({
    openingCash: 5000,
    cashSales: 10000,
    upiSales: 8000,
    cardSales: 2000,
    walletSales: 500,
    pdcSales: 0,
    countedCash: 15000,
  });
  assert.equal(matched.expectedCash, 15000);
  assert.equal(matched.cashVariance, 0);
  assert.equal(matched.varianceStatus, 'MATCHED');
  assert.equal(matched.totalDigitalCollection, 10500);
  assert.equal(matched.totalCounterCollection, 20500);

  const shortage = calculateShiftVariance({
    openingCash: 5000,
    cashSales: 4000,
    upiSales: 0,
    cardSales: 0,
    walletSales: 0,
    pdcSales: 0,
    countedCash: 8925,
  });
  assert.equal(shortage.cashVariance, -75);
  assert.equal(shortage.varianceStatus, 'SHORTAGE');
});

test('buildGlobalSearchResults finds supermarket items and modules with routable links', () => {
  const results = buildGlobalSearchResults(
    {
      items: [sampleGroceryItem, sampleWeighedProduceItem],
      ledgers: [],
      invoices: [],
      purchases: [],
      vouchers: [],
    },
    'tomato'
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].category, 'Item');
  assert.ok(results[0].href.startsWith('/admin/masters'));
});
